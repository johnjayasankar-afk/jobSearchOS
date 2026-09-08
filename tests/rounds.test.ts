import test from 'node:test'
import assert from 'node:assert/strict'
import { interviewRecord, preparedVsNot } from '../src/lib/analytics'
import {
  OUTCOME_AFTER_DAYS,
  OUTCOME_SNOOZE_DAYS,
  appendRun,
  formatSeconds,
  lengthVerdict,
  outcomeIsDue,
  typicalSeconds,
} from '../src/lib/rehearsal'
import { MAX_RECENT_RUNS, type Interview, type InterviewOutcome, type InterviewType, type Story } from '../src/lib/types'

const NOW = new Date('2026-09-08T10:00:00')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

let counter = 0
function iv(type: InterviewType, outcome: InterviewOutcome, patch: Partial<Interview> = {}): Interview {
  counter += 1
  return {
    id: `iv${counter}`,
    opportunityId: 'o1',
    scheduledAt: daysAgo(5),
    durationMinutes: 60,
    type,
    format: 'video',
    contactIds: [],
    questionsExpected: [],
    questionsToAsk: [],
    checklist: [],
    storyIds: [],
    outcome,
    followUpSent: false,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20),
    ...patch,
  }
}

function story(id: string, patch: Partial<Story> = {}): Story {
  return {
    id,
    title: id,
    situation: 's',
    task: 't',
    action: 'a',
    result: 'r',
    skills: [],
    tags: [],
    favorite: false,
    useCount: 0,
    rehearsalCount: 0,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
    ...patch,
  }
}

/* ------------------------------ which round ------------------------------- */

test('an interview still in the future is not counted as held', () => {
  const future = new Date(NOW.getTime() + 3 * 86_400_000).toISOString()
  const record = interviewRecord([iv('panel', 'pending', { scheduledAt: future })], NOW)
  assert.equal(record.held, 0)
  assert.equal(record.rounds.length, 0)
})

test('a cancelled interview never counts', () => {
  const record = interviewRecord([iv('panel', 'cancelled')], NOW)
  assert.equal(record.held, 0)
})

test('conversion counts only interviews with a result', () => {
  const record = interviewRecord(
    [iv('panel', 'advanced'), iv('panel', 'rejected'), iv('panel', 'pending')],
    NOW,
  )
  const panel = record.rounds.find((r) => r.type === 'panel')
  assert.ok(panel)
  assert.equal(panel.held, 3)
  assert.equal(panel.undecided, 1)
  assert.equal(panel.conversion.numerator, 1)
  assert.equal(panel.conversion.denominator, 2, 'the pending one must not be in the denominator')
})

test('the weakest round is the one that keeps ending it', () => {
  const record = interviewRecord(
    [
      iv('recruiter', 'advanced'),
      iv('recruiter', 'advanced'),
      iv('recruiter', 'advanced'),
      iv('panel', 'rejected'),
      iv('panel', 'rejected'),
      iv('panel', 'advanced'),
    ],
    NOW,
  )
  assert.equal(record.weakest?.type, 'panel')
  assert.equal(record.weakest?.rejected, 2)
})

test('one rejection is never enough to name a weakest round', () => {
  const record = interviewRecord([iv('panel', 'rejected'), iv('recruiter', 'advanced')], NOW)
  assert.equal(record.weakest, null)
})

test('a thin record says so rather than reading a pattern into it', () => {
  assert.equal(interviewRecord([iv('panel', 'advanced')], NOW).thin, true)
  const four = interviewRecord(
    [iv('panel', 'advanced'), iv('panel', 'rejected'), iv('case', 'advanced'), iv('case', 'rejected')],
    NOW,
  )
  assert.equal(four.thin, false)
  assert.equal(four.decided, 4)
})

test('rounds with no interviews are left out entirely', () => {
  const record = interviewRecord([iv('technical', 'advanced')], NOW)
  assert.deepEqual(record.rounds.map((r) => r.type), ['technical'])
})

/* ---------------------------- did prep show? ------------------------------ */

test('a story rehearsed before the interview counts as prepared', () => {
  const rehearsed = story('s1', { rehearsalCount: 2, lastRehearsedAt: daysAgo(7) })
  const result = preparedVsNot(
    [iv('panel', 'advanced', { storyIds: ['s1'], scheduledAt: daysAgo(5) })],
    [rehearsed],
    NOW,
  )
  assert.equal(result.preparedDecided, 1)
  assert.equal(result.preparedAdvanced, 1)
  assert.equal(result.unpreparedDecided, 0)
})

test('rehearsing after the interview does not count as having prepared for it', () => {
  // Otherwise practising today would retroactively improve last month's record.
  const rehearsedSince = story('s1', { rehearsalCount: 1, lastRehearsedAt: daysAgo(1) })
  const result = preparedVsNot(
    [iv('panel', 'rejected', { storyIds: ['s1'], scheduledAt: daysAgo(10) })],
    [rehearsedSince],
    NOW,
  )
  assert.equal(result.preparedDecided, 0)
  assert.equal(result.unpreparedDecided, 1)
})

test('undecided interviews are excluded from both sides', () => {
  const result = preparedVsNot([iv('panel', 'pending', { storyIds: [] })], [], NOW)
  assert.equal(result.preparedDecided, 0)
  assert.equal(result.unpreparedDecided, 0)
})

test('a comparison this small is never called reliable', () => {
  const rehearsed = story('s1', { rehearsalCount: 1, lastRehearsedAt: daysAgo(9) })
  const result = preparedVsNot(
    [
      iv('panel', 'advanced', { storyIds: ['s1'], scheduledAt: daysAgo(8) }),
      iv('panel', 'rejected', { storyIds: [] }),
    ],
    [rehearsed],
    NOW,
  )
  assert.equal(result.reliable, false)
})

/* --------------------------- chasing an outcome --------------------------- */

test('an outcome is asked for only once a decision is plausibly back', () => {
  assert.equal(outcomeIsDue(iv('panel', 'pending', { scheduledAt: daysAgo(2) }), NOW), false)
  assert.equal(
    outcomeIsDue(iv('panel', 'pending', { scheduledAt: daysAgo(OUTCOME_AFTER_DAYS + 1) }), NOW),
    true,
  )
})

test('an interview that already has a result is never chased', () => {
  for (const outcome of ['advanced', 'rejected', 'no_decision', 'cancelled'] as const) {
    assert.equal(
      outcomeIsDue(iv('panel', outcome, { scheduledAt: daysAgo(40) }), NOW),
      false,
      `${outcome} should not be chased`,
    )
  }
})

test('saying you are still waiting quiets the question for a week', () => {
  const justAsked = iv('panel', 'pending', {
    scheduledAt: daysAgo(30),
    outcomeAskedAt: daysAgo(1),
  })
  assert.equal(outcomeIsDue(justAsked, NOW), false)

  const askedLongAgo = iv('panel', 'pending', {
    scheduledAt: daysAgo(30),
    outcomeAskedAt: daysAgo(OUTCOME_SNOOZE_DAYS + 1),
  })
  assert.equal(outcomeIsDue(askedLongAgo, NOW), true)
})

test('recording an outcome is what lets the round analysis see the interview', () => {
  // The whole point of the prompt: before, this round is invisible.
  const pending = interviewRecord([iv('hiring_manager', 'pending', { scheduledAt: daysAgo(20) })], NOW)
  assert.equal(pending.rounds[0]?.conversion.denominator, 0)
  assert.equal(pending.decided, 0)

  const recorded = interviewRecord([iv('hiring_manager', 'rejected', { scheduledAt: daysAgo(20) })], NOW)
  assert.equal(recorded.rounds[0]?.conversion.denominator, 1)
  assert.equal(recorded.decided, 1)
})

/* ------------------------------ answer length ----------------------------- */

test('there is nothing to say about length until a run is recorded', () => {
  assert.equal(typicalSeconds(story('s1')), null)
})

test('the usual length is the median, so one odd run does not move it', () => {
  const s = story('s1', {
    recentRuns: [
      { at: daysAgo(1), seconds: 110, rating: 'solid' },
      { at: daysAgo(3), seconds: 105, rating: 'solid' },
      { at: daysAgo(5), seconds: 400, rating: 'shaky' },
    ],
  })
  assert.equal(typicalSeconds(s), 110)
})

test('an even number of runs averages the middle two', () => {
  const s = story('s1', {
    recentRuns: [
      { at: daysAgo(1), seconds: 100, rating: 'solid' },
      { at: daysAgo(2), seconds: 120, rating: 'solid' },
    ],
  })
  assert.equal(typicalSeconds(s), 110)
})

test('length is judged against the band, not against a rule about content', () => {
  assert.equal(lengthVerdict(45), 'short')
  assert.equal(lengthVerdict(100), 'good')
  assert.equal(lengthVerdict(240), 'long')
})

test('only the most recent runs are kept', () => {
  let s = story('s1')
  for (let i = 0; i < MAX_RECENT_RUNS + 3; i++) {
    s = { ...s, recentRuns: appendRun(s, { at: daysAgo(i), seconds: 100 + i, rating: 'solid' }) }
  }
  assert.equal(s.recentRuns?.length, MAX_RECENT_RUNS)
  // Newest first: the last one appended is at the front.
  assert.equal(s.recentRuns?.[0]?.seconds, 100 + MAX_RECENT_RUNS + 2)
})

test('durations render as minutes and seconds', () => {
  assert.equal(formatSeconds(0), '0:00')
  assert.equal(formatSeconds(65), '1:05')
  assert.equal(formatSeconds(600), '10:00')
})
