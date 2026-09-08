import test from 'node:test'
import assert from 'node:assert/strict'
import { renderTemplate, buildBuiltInTemplates, suggestCategory, tokensUsed } from '../src/lib/templates'
import { findDuplicates, roleSimilarity } from '../src/lib/duplicates'
import { buildIcs } from '../src/lib/calendar'
import { importContactsCsv, contactToRow, CONTACT_CSV_HEADERS, toCsv, parseCsv } from '../src/lib/csv'
import { describeBackupHealth } from '../src/lib/backup'
import { comparabilityNote, computeOfferValue } from '../src/lib/offers'
import { buildWeeklyReview, reviewIsDue } from '../src/lib/review'
import { DEFAULT_SETTINGS } from '../src/lib/types'
import type { Contact, Interview, MasterProfile, MessageTemplate, Opportunity } from '../src/lib/types'
import { addDays, toDateOnly } from '../src/lib/utils'

const isoAt = (n: number, hour = 10) => {
  const d = addDays(new Date(), n)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const opp = (over: Partial<Opportunity> = {}): Opportunity => ({
  id: 'o1',
  company: 'Halcyon Pay',
  role: 'Senior Product Manager, Payments Platform',
  workArrangement: 'hybrid',
  currency: 'USD',
  dateDiscovered: toDateOnly(addDays(new Date(), -30)),
  stage: 'applied',
  priority: 'high',
  tags: [],
  createdAt: isoAt(-30),
  updatedAt: isoAt(-1),
  stageChangedAt: isoAt(-1),
  stageHistory: [{ stage: 'applied', at: isoAt(-20) }],
  ...over,
})

const contact = (over: Partial<Contact> = {}): Contact => ({
  id: 'c1',
  name: 'Priya Raghavan',
  relationship: 'hiring_manager',
  opportunityIds: ['o1'],
  tags: [],
  createdAt: isoAt(-20),
  updatedAt: isoAt(-2),
  ...over,
})

const interview = (over: Partial<Interview> = {}): Interview => ({
  id: 'i1',
  opportunityId: 'o1',
  scheduledAt: isoAt(-1, 14),
  durationMinutes: 60,
  type: 'panel',
  format: 'video',
  contactIds: ['c1'],
  questionsExpected: [],
  questionsToAsk: ['How does the team decide what not to build?'],
  checklist: [],
  storyIds: [],
  outcome: 'pending',
  followUpSent: false,
  createdAt: isoAt(-7),
  updatedAt: isoAt(-7),
  ...over,
})

const profile = (over: Partial<MasterProfile> = {}): MasterProfile => ({
  id: 'master',
  name: 'Alex Mercer',
  targetRoles: [],
  skills: [],
  tools: [],
  domains: [],
  industries: [],
  companyTypes: [],
  locations: [],
  remotePreference: 'flexible',
  willingToRelocate: false,
  currency: 'USD',
  desiredKeywords: [],
  undesiredKeywords: [],
  updatedAt: isoAt(-1),
  ...over,
})

const template = (body: string, subject = ''): MessageTemplate => ({
  id: 't1',
  name: 'Test',
  category: 'other',
  subject,
  body,
  builtIn: false,
  createdAt: isoAt(-1),
  updatedAt: isoAt(-1),
})

/* ------------------------------- templates -------------------------------- */

test('template substitution fills known values', () => {
  const result = renderTemplate(
    template('Hi {{first_name}}, about {{role}} at {{company}}. — {{my_name}}', 'Re: {{role}}'),
    { contact: contact(), opportunity: opp(), profile: profile() },
  )
  assert.equal(result.subject, 'Re: Senior Product Manager, Payments Platform')
  assert.match(result.body, /^Hi Priya, about Senior Product Manager, Payments Platform at Halcyon Pay\. — Alex Mercer$/)
  assert.equal(result.missing.length, 0)
})

test('missing values stay visible as placeholders and are reported', () => {
  const result = renderTemplate(template('Hi {{first_name}}, signed {{my_name}}'), {
    opportunity: opp(),
    profile: profile({ name: undefined }),
  })
  assert.ok(result.body.includes('{{first_name}}'))
  assert.ok(result.body.includes('{{my_name}}'))
  assert.equal(result.missing.length, 2)
  assert.ok(result.missing.some((m) => m.requires.includes('contact')))
})

test('unknown placeholders are reported rather than silently dropped', () => {
  const result = renderTemplate(template('Hello {{nonsense_token}}'), {})
  assert.deepEqual(result.unknown, ['nonsense_token'])
  assert.ok(result.body.includes('{{nonsense_token}}'))
})

test('days since applied renders as a number', () => {
  const result = renderTemplate(template('It has been {{days_since_applied}} days'), {
    opportunity: opp({ dateApplied: toDateOnly(addDays(new Date(), -12)) }),
  })
  assert.equal(result.body, 'It has been 12 days')
})

test('every built-in template only uses known placeholders', () => {
  for (const t of buildBuiltInTemplates()) {
    const { unknown } = renderTemplate(t, {})
    assert.deepEqual(unknown, [], `${t.name} uses unknown tokens`)
    assert.ok(tokensUsed(t).length > 0, `${t.name} uses no placeholders`)
    assert.ok(t.body.trim().length > 40)
  }
})

test('the suggested category follows the situation', () => {
  assert.equal(suggestCategory({ interview: interview() }), 'interview_thank_you')
  assert.equal(suggestCategory({ opportunity: opp({ stage: 'offer' }) }), 'offer')
  assert.equal(suggestCategory({ contact: contact({ relationship: 'recruiter' }) }), 'recruiter_reply')
  assert.equal(
    suggestCategory({ contact: contact({ relationship: 'referral' }), opportunity: opp() }),
    'referral_request',
  )
})

/* ------------------------------- duplicates ------------------------------- */

test('the same role at the same company is flagged', () => {
  const report = findDuplicates([opp()], {
    company: 'Halcyon Pay',
    role: 'Senior Product Manager, Payments Platform',
  })
  assert.equal(report.likely.length, 1)
})

test('seniority prefixes do not hide a duplicate', () => {
  const report = findDuplicates([opp({ role: 'Product Manager, Payments Platform' })], {
    company: 'Halcyon Pay',
    role: 'Senior Product Manager, Payments Platform',
  })
  assert.equal(report.likely.length, 1)
})

test('a different role at the same company is context, not a duplicate', () => {
  const report = findDuplicates([opp({ role: 'Data Scientist, Risk' })], {
    company: 'Halcyon Pay',
    role: 'Senior Product Manager, Payments Platform',
  })
  assert.equal(report.likely.length, 0)
  assert.equal(report.sameCompany.length, 1)
})

test('an identical posting URL is conclusive on its own', () => {
  const report = findDuplicates([opp({ jobUrl: 'https://jobs.example/1' })], {
    company: 'Totally Different Ltd',
    role: 'Something Else',
    jobUrl: 'https://jobs.example/1',
  })
  assert.equal(report.likely.length, 1)
})

test('the record being edited is never its own duplicate', () => {
  const existing = opp()
  const report = findDuplicates([existing], { company: existing.company, role: existing.role }, existing.id)
  assert.equal(report.likely.length, 0)
  assert.equal(report.sameCompany.length, 0)
})

test('role similarity is symmetric and bounded', () => {
  assert.equal(roleSimilarity('Product Manager', 'Product Manager'), 1)
  assert.equal(roleSimilarity('Product Manager', 'Warehouse Supervisor'), 0)
  assert.equal(
    roleSimilarity('Senior Product Manager', 'Product Manager'),
    roleSimilarity('Product Manager', 'Senior Product Manager'),
  )
})

/* -------------------------------- calendar -------------------------------- */

test('ics output is well formed', () => {
  const ics = buildIcs([{ interview: interview(), opportunity: opp(), interviewerNames: ['Priya Raghavan'] }])
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'))
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1)
  assert.equal((ics.match(/END:VEVENT/g) ?? []).length, 1)
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z/)
  assert.match(ics, /DTEND:\d{8}T\d{6}Z/)
  assert.match(ics, /SUMMARY:Panel interview — Halcyon Pay/)
  // Every line must be CRLF-terminated and within the folding limit.
  for (const line of ics.split('\r\n')) assert.ok(line.length <= 75, `line too long: ${line}`)
})

test('ics escapes commas and newlines in free text', () => {
  const ics = buildIcs([
    {
      interview: interview({ prepNotes: 'Two things: pricing, and staffing\nsecond line' }),
      opportunity: opp(),
      interviewerNames: [],
    },
  ])
  const unfolded = ics.replace(/\r\n /g, '')
  assert.ok(unfolded.includes('pricing\\, and staffing\\nsecond line'))
})

test('an unreadable date produces no event rather than a broken one', () => {
  const ics = buildIcs([
    { interview: interview({ scheduledAt: 'not-a-date' }), opportunity: opp(), interviewerNames: [] },
  ])
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 0)
})

/* ------------------------------ contacts CSV ------------------------------ */

test('contact csv round-trips through the parser', () => {
  const csv = toCsv([...CONTACT_CSV_HEADERS], [contactToRow(contact({ company: 'Halcyon, Pay', tags: ['Warm'] }))])
  const rows = parseCsv(csv)
  assert.equal(rows[1]?.[0], 'Priya Raghavan')
  assert.equal(rows[1]?.[2], 'Halcyon, Pay')
})

test('contact import maps aliased headers and splits names', () => {
  const csv = [
    'First Name,Last Name,Type,Organization,Email Address,Follow-up,Labels',
    'Priya,Raghavan,Hiring Manager,Halcyon Pay,priya@example.com,03/14/2026,"Warm; Decision maker"',
  ].join('\n')
  const result = importContactsCsv(csv)
  assert.equal(result.records.length, 1)
  const record = result.records[0]!
  assert.equal(record.name, 'Priya Raghavan')
  assert.equal(record.relationship, 'hiring_manager')
  assert.equal(record.company, 'Halcyon Pay')
  assert.equal(record.nextFollowUpDate, '2026-03-14')
  assert.deepEqual(record.tags, ['Warm', 'Decision maker'])
})

test('contact import rejects a file with no name column', () => {
  const result = importContactsCsv('Foo,Bar\n1,2')
  assert.equal(result.records.length, 0)
  assert.equal(result.issues[0]?.severity, 'error')
})

test('contact import warns about a bad email but keeps the row', () => {
  const result = importContactsCsv('Name,Email\nAda Lovelace,not-an-email')
  assert.equal(result.records.length, 1)
  assert.equal(result.records[0]?.email, undefined)
  assert.ok(result.issues.some((i) => i.severity === 'warning'))
})

/* ------------------------------ backup health ----------------------------- */

test('a small workspace does not nag about backups', () => {
  const health = describeBackupHealth(undefined, 2)
  assert.equal(health.state, 'none-needed')
  assert.equal(health.nudge, false)
})

test('a real workspace with no backup is flagged once it has some age', () => {
  const health = describeBackupHealth(undefined, 20, 30)
  assert.equal(health.state, 'never')
  assert.equal(health.nudge, true)
})

test('a workspace created minutes ago is not nagged about backups', () => {
  // Loading the demo seeds thirty records at once; that is not a reason to
  // warn someone about losing work they have not done yet.
  const fresh = describeBackupHealth(undefined, 30, 0)
  assert.equal(fresh.state, 'never')
  assert.equal(fresh.nudge, false)
  assert.equal(describeBackupHealth(undefined, 30, 20).nudge, false)
  assert.equal(describeBackupHealth(undefined, 30, 21).nudge, true)
})

test('a recent backup is not flagged', () => {
  const health = describeBackupHealth(isoAt(-2), 20)
  assert.equal(health.state, 'fresh')
  assert.equal(health.nudge, false)
})

test('a stale backup nags only past the higher threshold', () => {
  assert.equal(describeBackupHealth(isoAt(-16), 20).state, 'stale')
  assert.equal(describeBackupHealth(isoAt(-16), 20).nudge, false)
  assert.equal(describeBackupHealth(isoAt(-40), 20).nudge, true)
})

/* --------------------------------- offers --------------------------------- */

test('offer maths separates one-off pay from recurring pay', () => {
  const value = computeOfferValue({
    status: 'received',
    baseSalary: 200000,
    bonus: 30000,
    signOn: 20000,
    equityValue: 240000,
    equityYears: 4,
    currency: 'USD',
  })
  // First year carries the sign-on; later years do not.
  assert.equal(value.firstYear, 200000 + 30000 + 20000 + 60000)
  assert.equal(value.steadyYear, 200000 + 30000 + 60000)
  assert.equal(value.total, 200000 * 4 + 30000 * 4 + 20000 + 240000)
  assert.deepEqual(value.missing, [])
})

test('a missing figure is reported rather than counted as zero', () => {
  const value = computeOfferValue({ status: 'received', baseSalary: 180000, currency: 'USD' })
  assert.equal(value.firstYear, 180000)
  assert.ok(value.missing.includes('bonus'))
  assert.ok(value.missing.includes('equity'))
  assert.equal(value.usable, true)
})

test('equity described but not valued is flagged, not guessed', () => {
  const value = computeOfferValue({ status: 'received', baseSalary: 100000, equity: '0.1% over 4 years' })
  assert.ok(value.missing.some((m) => m.includes('value for the equity')))
  assert.equal(value.total, 400000)
})

test('an empty offer is not usable', () => {
  const value = computeOfferValue(undefined)
  assert.equal(value.usable, false)
  assert.equal(value.total, 0)
})

test('vesting length defaults to four years and is respected when set', () => {
  assert.equal(computeOfferValue({ status: 'received', equityValue: 100000 }).years, 4)
  assert.equal(computeOfferValue({ status: 'received', equityValue: 100000, equityYears: 3 }).years, 3)
  assert.equal(computeOfferValue({ status: 'received', equityValue: 90000, equityYears: 3 }).steadyYear, 30000)
})

test('mixed currencies are called out instead of silently summed', () => {
  const note = comparabilityNote([
    computeOfferValue({ status: 'received', baseSalary: 1, currency: 'USD' }),
    computeOfferValue({ status: 'received', baseSalary: 1, currency: 'EUR' }),
  ])
  assert.match(note ?? '', /different currencies/)
})

/* ------------------------------ weekly review ----------------------------- */

test('the review counts only what happened inside the window', () => {
  const review = buildWeeklyReview({
    opportunities: [
      opp({ id: 'recent', dateApplied: toDateOnly(addDays(new Date(), -2)) }),
      opp({ id: 'old', dateApplied: toDateOnly(addDays(new Date(), -30)) }),
    ],
    contacts: [contact({ lastContactDate: toDateOnly(addDays(new Date(), -3)) })],
    interviews: [interview({ scheduledAt: isoAt(-2) }), interview({ id: 'i2', scheduledAt: isoAt(-40) })],
    settings: { ...DEFAULT_SETTINGS, updatedAt: isoAt(0) },
  })
  assert.equal(review.applied.length, 1)
  assert.equal(review.outreach.length, 1)
  assert.equal(review.interviewsHeld.length, 1)
  assert.equal(review.quiet, false)
})

test('a stage change inside the window is reported with where it came from', () => {
  const review = buildWeeklyReview({
    opportunities: [
      opp({
        stage: 'onsite',
        stageHistory: [
          { stage: 'applied', at: isoAt(-30) },
          { stage: 'recruiter_screen', at: isoAt(-20) },
          { stage: 'onsite', at: isoAt(-3) },
        ],
      }),
    ],
    contacts: [],
    interviews: [],
    settings: { ...DEFAULT_SETTINGS, updatedAt: isoAt(0) },
  })
  assert.equal(review.moved.length, 1)
  assert.equal(review.moved[0]?.from, 'recruiter_screen')
  assert.equal(review.moved[0]?.to, 'onsite')
  assert.equal(review.moved[0]?.isSetback, false)
})

test('back-and-forth moves collapse to the net change', () => {
  const review = buildWeeklyReview({
    opportunities: [
      opp({
        id: 'churn',
        stage: 'applied',
        stageHistory: [
          { stage: 'applying', at: isoAt(-30) },
          { stage: 'applied', at: isoAt(-4) },
          { stage: 'applying', at: isoAt(-3) },
          { stage: 'applied', at: isoAt(-2) },
        ],
      }),
    ],
    contacts: [],
    interviews: [],
    settings: { ...DEFAULT_SETTINGS, updatedAt: isoAt(0) },
  })
  assert.equal(review.moved.length, 1)
  assert.equal(review.moved[0]?.from, 'applying')
  assert.equal(review.moved[0]?.to, 'applied')
  assert.equal(review.moved[0]?.steps, 3)
})

test('a record that ends the week where it started is not listed', () => {
  const review = buildWeeklyReview({
    opportunities: [
      opp({
        id: 'roundtrip',
        stage: 'applying',
        stageHistory: [
          { stage: 'applying', at: isoAt(-30) },
          { stage: 'applied', at: isoAt(-3) },
          { stage: 'applying', at: isoAt(-2) },
        ],
      }),
    ],
    contacts: [],
    interviews: [],
    settings: { ...DEFAULT_SETTINGS, updatedAt: isoAt(0) },
  })
  assert.equal(review.moved.length, 0)
})

test('a move into a closed stage counts as a setback', () => {
  const review = buildWeeklyReview({
    opportunities: [
      opp({
        stage: 'rejected',
        stageHistory: [
          { stage: 'applied', at: isoAt(-30) },
          { stage: 'rejected', at: isoAt(-1) },
        ],
      }),
    ],
    contacts: [],
    interviews: [],
    settings: { ...DEFAULT_SETTINGS, updatedAt: isoAt(0) },
  })
  assert.equal(review.moved[0]?.isSetback, true)
})

test('stalled work is surfaced with the reason it stalled', () => {
  const review = buildWeeklyReview({
    opportunities: [
      opp({ id: 'waiting', stage: 'applied', dateApplied: toDateOnly(addDays(new Date(), -20)), updatedAt: isoAt(-20) }),
    ],
    contacts: [],
    interviews: [],
    settings: { ...DEFAULT_SETTINGS, updatedAt: isoAt(0) },
  })
  assert.equal(review.stalled.length, 1)
  assert.match(review.stalled[0]?.reason ?? '', /no reply/)
})

test('archived and closed records are never called stalled', () => {
  const review = buildWeeklyReview({
    opportunities: [
      opp({ id: 'a', archivedAt: isoAt(-1), updatedAt: isoAt(-90) }),
      opp({ id: 'b', stage: 'rejected', updatedAt: isoAt(-90) }),
    ],
    contacts: [],
    interviews: [],
    settings: { ...DEFAULT_SETTINGS, updatedAt: isoAt(0) },
  })
  assert.equal(review.stalled.length, 0)
})

test('a review is due a week after the last one, and not before', () => {
  assert.equal(reviewIsDue(isoAt(-2), isoAt(-60)), false)
  assert.equal(reviewIsDue(isoAt(-8), isoAt(-60)), true)
  // Never reviewed: only once there is a week of history to look at.
  assert.equal(reviewIsDue(undefined, isoAt(-2)), false)
  assert.equal(reviewIsDue(undefined, isoAt(-20)), true)
  assert.equal(reviewIsDue(undefined, undefined), false)
})
