import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, toCsv, importOpportunitiesCsv, parseFlexibleDate } from '../src/lib/csv'
import { validateWorkspace } from '../src/lib/backup'
import { buildAgenda, selectFocus, buildUpcoming } from '../src/lib/agenda'
import { computeFunnel, furthestStage, gotResponse, summarize, rate } from '../src/lib/analytics'
import { DEFAULT_SETTINGS, type Contact, type Interview, type Opportunity } from '../src/lib/types'
import { toDateOnly, addDays } from '../src/lib/utils'

const d = (n: number) => toDateOnly(addDays(new Date(), n))
const isoAt = (n: number, hour = 10) => {
  const x = addDays(new Date(), n)
  x.setHours(hour, 0, 0, 0)
  return x.toISOString()
}

const opp = (over: Partial<Opportunity> = {}): Opportunity => ({
  id: 'o1',
  company: 'Acme',
  role: 'Product Manager',
  workArrangement: 'remote',
  currency: 'USD',
  dateDiscovered: d(-30),
  stage: 'saved',
  priority: 'medium',
  tags: [],
  createdAt: isoAt(-30),
  updatedAt: isoAt(-1),
  stageChangedAt: isoAt(-1),
  stageHistory: [{ stage: 'saved', at: isoAt(-30) }],
  ...over,
})

/* ------------------------------- CSV -------------------------------------- */

test('csv round-trips quotes, commas and newlines', () => {
  const csv = toCsv(['a', 'b'], [['he said "hi"', 'x,y'], ['line1\nline2', '']])
  const rows = parseCsv(csv)
  assert.deepEqual(rows[0], ['a', 'b'])
  assert.deepEqual(rows[1], ['he said "hi"', 'x,y'])
  assert.deepEqual(rows[2], ['line1\nline2', ''])
})

test('csv escapes leading characters that spreadsheets treat as formulas', () => {
  const csv = toCsv(['a'], [['=SUM(A1:A2)']])
  assert.ok(csv.includes("'=SUM"))
})

test('csv import maps aliased headers and normalises values', () => {
  const csv = [
    'Company,Job Title,Status,Priority,Applied,Link,Labels,Max Salary',
    'Northwind Labs,Senior PM,Phone Screen,high,03/14/2026,acme.com/jobs/1,"Fintech; AI",180000',
  ].join('\n')
  const result = importOpportunitiesCsv(csv)
  assert.equal(result.records.length, 1)
  const record = result.records[0]!
  assert.equal(record.company, 'Northwind Labs')
  assert.equal(record.stage, 'recruiter_screen')
  assert.equal(record.priority, 'high')
  assert.equal(record.dateApplied, '2026-03-14')
  assert.equal(record.jobUrl, 'https://acme.com/jobs/1')
  assert.deepEqual(record.tags, ['Fintech', 'AI'])
  assert.equal(record.salaryMax, 180000)
})

test('csv import rejects a file without company and role columns', () => {
  const result = importOpportunitiesCsv('Foo,Bar\n1,2')
  assert.equal(result.records.length, 0)
  assert.equal(result.issues[0]?.severity, 'error')
})

test('csv import reports bad rows without discarding good ones', () => {
  const csv = ['Company,Role,Stage', 'Acme,PM,Applied', ',Orphan Role,Applied', 'Beta,Analyst,Nonsense'].join('\n')
  const result = importOpportunitiesCsv(csv)
  assert.equal(result.records.length, 2)
  assert.ok(result.issues.some((i) => i.severity === 'error'))
  assert.ok(result.issues.some((i) => i.severity === 'warning' && i.message.includes('Nonsense')))
})

test('csv import swaps a reversed salary range and warns', () => {
  const result = importOpportunitiesCsv('Company,Role,Salary Min,Salary Max\nAcme,PM,200000,150000')
  assert.equal(result.records[0]?.salaryMin, 150000)
  assert.equal(result.records[0]?.salaryMax, 200000)
  assert.ok(result.issues.some((i) => i.message.includes('swapped')))
})

test('flexible dates handle ISO, US and unambiguous day-first input', () => {
  assert.equal(parseFlexibleDate('2026-02-09'), '2026-02-09')
  assert.equal(parseFlexibleDate('2/9/2026'), '2026-02-09')
  assert.equal(parseFlexibleDate('19/02/2026'), '2026-02-19')
  assert.equal(parseFlexibleDate('not a date'), undefined)
})

/* ------------------------------ backup ------------------------------------ */

test('restore rejects a file that is not a workspace backup', () => {
  const r = validateWorkspace({ hello: 'world' })
  assert.equal(r.ok, false)
  assert.match(r.fatal ?? '', /not an Opportunity OS backup/i)
})

test('restore rejects a newer schema version', () => {
  const r = validateWorkspace({ format: 'opportunity-os.workspace', schemaVersion: 99, data: {} })
  assert.equal(r.ok, false)
  assert.match(r.fatal ?? '', /newer version/i)
})

test('restore drops malformed records and keeps valid ones', () => {
  const r = validateWorkspace({
    format: 'opportunity-os.workspace',
    schemaVersion: 1,
    data: {
      opportunities: [
        { id: 'a', company: 'Acme', role: 'PM', stage: 'applied' },
        { id: 'b', company: '', role: 'Broken' },
        'nonsense',
      ],
      contacts: [{ id: 'c1', name: 'Ada', opportunityIds: ['a', 'missing'] }],
      interviews: [{ id: 'i1', opportunityId: 'ghost', scheduledAt: new Date().toISOString() }],
      stories: [{ id: 's1', title: 'A story' }],
    },
  })
  assert.equal(r.ok, true)
  assert.equal(r.payload?.opportunities.length, 1)
  assert.deepEqual(r.payload?.contacts[0]?.opportunityIds, ['a'])
  assert.equal(r.payload?.interviews.length, 0)
  assert.ok(r.warnings.length >= 2)
})

test('restore refuses an empty payload', () => {
  const r = validateWorkspace({ format: 'opportunity-os.workspace', schemaVersion: 1, data: { opportunities: [] } })
  assert.equal(r.ok, false)
})

test('restore coerces unknown enum values to safe defaults', () => {
  const r = validateWorkspace({
    format: 'opportunity-os.workspace',
    schemaVersion: 1,
    data: { opportunities: [{ id: 'a', company: 'Acme', role: 'PM', stage: 'hacked', priority: 'urgent' }] },
  })
  assert.equal(r.payload?.opportunities[0]?.stage, 'saved')
  assert.equal(r.payload?.opportunities[0]?.priority, 'medium')
})

/* ------------------------------ agenda ------------------------------------ */

const settings = { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() }

test('an overdue next action outranks a stale opportunity', () => {
  const items = buildAgenda({
    opportunities: [
      opp({ id: 'a', nextAction: 'Send case study', nextActionDate: d(-3), stage: 'onsite' }),
      opp({ id: 'b', company: 'Stale Co', updatedAt: isoAt(-40), stage: 'applied' }),
    ],
    contacts: [],
    interviews: [],
    settings,
  })
  assert.equal(items[0]?.kind, 'next_action_overdue')
  assert.ok(items.some((i) => i.kind === 'stale_opportunity' || i.kind === 'awaiting_response'))
})

test('an interview tomorrow with open prep ranks at the top', () => {
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [
      {
        id: 'i1',
        opportunityId: 'a',
        scheduledAt: isoAt(1, 14),
        durationMinutes: 60,
        type: 'panel',
        format: 'video',
        contactIds: [],
        questionsExpected: [],
        questionsToAsk: [],
        checklist: [{ id: 'c', text: 'Prep', done: false }],
        storyIds: [],
        outcome: 'pending',
        followUpSent: false,
        createdAt: isoAt(-5),
        updatedAt: isoAt(-5),
      },
    ],
    settings,
  })
  assert.equal(items[0]?.kind, 'interview_prep')
  assert.ok(items[0]?.reason.includes('prep'))
})

function interviewWithStories(storyIds: string[]) {
  return {
    id: 'i1',
    opportunityId: 'a',
    scheduledAt: isoAt(1, 14),
    durationMinutes: 60,
    type: 'panel' as const,
    format: 'video' as const,
    contactIds: [],
    questionsExpected: [],
    questionsToAsk: [],
    checklist: [],
    storyIds,
    outcome: 'pending' as const,
    followUpSent: false,
    createdAt: isoAt(-5),
    updatedAt: isoAt(-5),
  }
}

function testStory(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    title: id,
    situation: 's',
    task: 't',
    action: 'a',
    result: 'r',
    skills: [],
    tags: ['Leadership'],
    favorite: false,
    useCount: 0,
    rehearsalCount: 0,
    createdAt: isoAt(-40),
    updatedAt: isoAt(-40),
    ...patch,
  }
}

test('an interview tomorrow afternoon is called tomorrow, not today', () => {
  // 18 hours away, but a different calendar day: the label follows the date.
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [interviewWithStories([])],
    settings,
  })
  const prep = items.find((i) => i.kind === 'interview_prep')
  assert.ok(prep)
  assert.ok(prep.reason.includes('tomorrow'), `expected "tomorrow" in: ${prep.reason}`)
  assert.equal(prep.dueLabel, 'Tomorrow')
})

test('an upcoming interview with unpractised stories asks you to rehearse', () => {
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [interviewWithStories(['s1', 's2'])],
    stories: [testStory('s1'), testStory('s2')],
    settings,
  })
  const rehearse = items.find((i) => i.kind === 'interview_rehearse')
  assert.ok(rehearse, 'expected a rehearsal action')
  assert.ok(rehearse.reason.includes('2 of 2'))
  assert.equal(rehearse.primary.command.kind, 'rehearse_interview')
})

test('rehearsed stories stop the rehearsal prompt', () => {
  const practised = { rehearsalCount: 2, lastRehearsedAt: isoAt(-2), lastRehearsalRating: 'solid' }
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [interviewWithStories(['s1'])],
    stories: [testStory('s1', practised)],
    settings,
  })
  assert.ok(!items.some((i) => i.kind === 'interview_rehearse'))
})

test('an interview with no stories pinned is not nagged about rehearsing', () => {
  // Choosing your answers comes first; the app should not skip that step.
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [interviewWithStories([])],
    stories: [testStory('s1')],
    settings,
  })
  assert.ok(!items.some((i) => i.kind === 'interview_rehearse'))
})

test('an interview that just happened asks for a debrief', () => {
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [{ ...interviewWithStories([]), scheduledAt: isoAt(-1, 14) }],
    settings,
  })
  const debrief = items.find((i) => i.kind === 'interview_debrief')
  assert.ok(debrief, 'expected a debrief action')
  assert.equal(debrief.primary.command.kind, 'debrief_interview')
  assert.ok(debrief.reason.includes('asked'))
})

test('a debrief prompt says how long ago it actually was', () => {
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [{ ...interviewWithStories([]), scheduledAt: isoAt(-2, 15) }],
    settings,
  })
  const debrief = items.find((i) => i.kind === 'interview_debrief')
  assert.ok(debrief)
  assert.ok(debrief.reason.includes('2 days ago'), `expected "2 days ago" in: ${debrief.reason}`)
  assert.equal(debrief.dueLabel, '2d ago')
})

test('a debriefed interview is not asked about again', () => {
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [
      { ...interviewWithStories([]), scheduledAt: isoAt(-1, 14), debriefedAt: isoAt(-1) },
    ],
    settings,
  })
  assert.ok(!items.some((i) => i.kind === 'interview_debrief'))
})

test('an interview from last month is past debriefing', () => {
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [{ ...interviewWithStories([]), scheduledAt: isoAt(-30, 14) }],
    settings,
  })
  assert.ok(!items.some((i) => i.kind === 'interview_debrief'))
})

test('an interview with no result recorded is chased once it is old enough', () => {
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [{ ...interviewWithStories([]), scheduledAt: isoAt(-14, 14) }],
    settings,
  })
  const ask = items.find((i) => i.kind === 'interview_outcome')
  assert.ok(ask, 'expected an outcome prompt')
  assert.equal(ask.primary.command.kind, 'record_outcome')
  assert.ok(ask.reason.includes('14 days'))
})

test('a fresh interview is debriefed, not chased for a result', () => {
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', stage: 'onsite' })],
    contacts: [],
    interviews: [{ ...interviewWithStories([]), scheduledAt: isoAt(-1, 14) }],
    settings,
  })
  assert.ok(items.some((i) => i.kind === 'interview_debrief'))
  assert.ok(!items.some((i) => i.kind === 'interview_outcome'))
})

test('every action explains itself', () => {
  const items = buildAgenda({
    opportunities: [
      opp({ id: 'a', stage: 'applied', dateApplied: d(-20), updatedAt: isoAt(-20) }),
      opp({ id: 'b', stage: 'evaluating', priority: 'high', stageChangedAt: isoAt(-12) }),
    ],
    contacts: [
      {
        id: 'c1',
        name: 'Ada Lovelace',
        relationship: 'referral',
        opportunityIds: ['a'],
        nextFollowUpDate: d(-2),
        tags: [],
        createdAt: isoAt(-30),
        updatedAt: isoAt(-30),
      } as Contact,
    ],
    interviews: [],
    settings,
  })
  assert.ok(items.length >= 3)
  for (const item of items) {
    assert.ok(item.reason.length > 10, `missing reason for ${item.kind}`)
    assert.ok(item.title.length > 0)
    assert.ok(item.primary.label.length > 0)
  }
})

test('focus caps how much one opportunity can dominate', () => {
  const many = Array.from({ length: 6 }, (_, i) =>
    opp({ id: `o${i}`, company: `Co ${i}`, nextAction: 'Do it', nextActionDate: d(-i - 1) }),
  )
  const items = buildAgenda({ opportunities: many, contacts: [], interviews: [], settings })
  const focus = selectFocus(items, 5)
  assert.equal(focus.length, 5)
  const perOpp = new Map<string, number>()
  for (const f of focus) perOpp.set(f.opportunityId ?? '', (perOpp.get(f.opportunityId ?? '') ?? 0) + 1)
  assert.ok([...perOpp.values()].every((n) => n <= 2))
})

test('an empty workspace produces no actions', () => {
  assert.equal(buildAgenda({ opportunities: [], contacts: [], interviews: [], settings }).length, 0)
})

test('archived opportunities never appear in the agenda', () => {
  const items = buildAgenda({
    opportunities: [opp({ id: 'a', archivedAt: isoAt(-1), nextAction: 'X', nextActionDate: d(-5) })],
    contacts: [],
    interviews: [],
    settings,
  })
  assert.equal(items.length, 0)
})

test('upcoming is ordered and windowed', () => {
  const entries = buildUpcoming({
    opportunities: [
      opp({ id: 'a', nextAction: 'Later', nextActionDate: d(3) }),
      opp({ id: 'b', nextAction: 'Way later', nextActionDate: d(60) }),
    ],
    contacts: [],
    interviews: [],
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0]?.title, 'Later')
})

/* ----------------------------- analytics ---------------------------------- */

test('furthest stage remembers progress before a rejection', () => {
  const o = opp({
    stage: 'rejected',
    stageHistory: [
      { stage: 'saved', at: isoAt(-40) },
      { stage: 'applied', at: isoAt(-35) },
      { stage: 'recruiter_screen', at: isoAt(-25) },
      { stage: 'onsite', at: isoAt(-12) },
      { stage: 'rejected', at: isoAt(-5) },
    ],
  })
  assert.equal(furthestStage(o), 'onsite')
  assert.equal(gotResponse(o), true)
})

test('an application with no reply is not counted as a response', () => {
  const o = opp({ stage: 'applied', dateApplied: d(-20), stageHistory: [{ stage: 'applied', at: isoAt(-20) }] })
  assert.equal(gotResponse(o), false)
})

test('funnel counts are monotonically non-increasing', () => {
  const steps = computeFunnel([
    opp({ id: '1', stage: 'applied', stageHistory: [{ stage: 'applied', at: isoAt(-9) }] }),
    opp({ id: '2', stage: 'onsite', stageHistory: [{ stage: 'applied', at: isoAt(-9) }, { stage: 'onsite', at: isoAt(-2) }] }),
    opp({ id: '3', stage: 'offer', stageHistory: [{ stage: 'applied', at: isoAt(-9) }, { stage: 'offer', at: isoAt(-1) }] }),
  ])
  for (let i = 1; i < steps.length; i++) {
    assert.ok((steps[i]?.count ?? 0) <= (steps[i - 1]?.count ?? 0))
  }
  assert.equal(steps[0]?.count, 3)
})

test('rates carry their denominator and flag small samples', () => {
  const small = rate(1, 3)
  assert.equal(small.reliable, false)
  assert.equal(rate(0, 0).value, null)
  assert.equal(rate(5, 20).reliable, true)
})

test('summary handles an empty workspace without dividing by zero', () => {
  const s = summarize([])
  assert.equal(s.responseRate.value, null)
  assert.equal(s.medianDaysToFirstResponse, null)
  assert.equal(s.totalOpportunities, 0)
})

test('interviews scheduled in the future do not break the summary', () => {
  const interviews: Interview[] = []
  assert.equal(interviews.length, 0)
  const s = summarize([opp({ stage: 'applied', dateApplied: d(-5), stageHistory: [{ stage: 'applied', at: isoAt(-5) }] })])
  assert.equal(s.applied, 1)
  assert.equal(s.responseRate.numerator, 0)
})
