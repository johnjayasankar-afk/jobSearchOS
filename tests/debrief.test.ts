import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEBRIEF_WINDOW_DAYS,
  MIN_INTERVIEWS_FOR_PATTERN,
  askedCount,
  buildDebriefInsights,
  debriefIsDue,
  questionsForDebrief,
  themeGaps,
} from '../src/lib/debrief'
import { QUESTIONS, resolveBank } from '../src/lib/questions'
import type { AskedQuestion, Interview, Story } from '../src/lib/types'

const NOW = new Date('2026-09-07T10:00:00')
const isoDaysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

function interview(patch: Partial<Interview> & { id: string }): Interview {
  return {
    opportunityId: 'o1',
    scheduledAt: isoDaysAgo(2),
    durationMinutes: 60,
    type: 'behavioral',
    format: 'video',
    contactIds: [],
    questionsExpected: [],
    questionsToAsk: [],
    checklist: [],
    storyIds: [],
    outcome: 'pending',
    followUpSent: false,
    createdAt: isoDaysAgo(10),
    updatedAt: isoDaysAgo(10),
    ...patch,
  }
}

function debriefed(id: string, asked: AskedQuestion[], patch: Partial<Interview> = {}): Interview {
  return interview({ id, debriefedAt: isoDaysAgo(1), askedQuestions: asked, ...patch })
}

function story(title: string, tags: string[], complete = true): Story {
  return {
    id: title,
    title,
    situation: 's',
    task: 't',
    action: 'a',
    result: complete ? 'r' : undefined,
    skills: [],
    tags,
    favorite: false,
    useCount: 0,
    rehearsalCount: 0,
    createdAt: isoDaysAgo(40),
    updatedAt: isoDaysAgo(40),
  }
}

/* ------------------------------- counting -------------------------------- */

test('an interview with no debrief contributes nothing', () => {
  const insights = buildDebriefInsights([interview({ id: 'a' })])
  assert.equal(insights.debriefed, 0)
  assert.equal(insights.recorded.length, 0)
})

test('questions are counted across the interviews they came up in', () => {
  const insights = buildDebriefInsights([
    debriefed('a', [{ questionId: 'fail-project', verdict: 'well' }]),
    debriefed('b', [{ questionId: 'fail-project', verdict: 'badly' }]),
    debriefed('c', [{ questionId: 'conflict-manager', verdict: 'ok' }]),
  ])
  assert.equal(insights.debriefed, 3)
  const top = insights.recorded[0]
  assert.equal(top?.question.id, 'fail-project')
  assert.equal(top?.asked, 2)
  assert.equal(top?.struggled, 1)
})

test('the same question twice in one interview counts once', () => {
  // Interviewers circle back; that is one interview, not two data points.
  const insights = buildDebriefInsights([
    debriefed('a', [
      { questionId: 'fail-project', verdict: 'well' },
      { questionId: 'fail-project', verdict: 'badly' },
    ]),
  ])
  assert.equal(insights.recorded[0]?.asked, 1)
})

test('an unknown question id is not counted as a bank question', () => {
  const insights = buildDebriefInsights([debriefed('a', [{ questionId: 'not-a-real-id', verdict: 'ok' }])])
  assert.equal(insights.recorded.length, 0)
  assert.equal(insights.offBank.length, 0)
})

test('questions the bank does not carry are kept separately', () => {
  const insights = buildDebriefInsights([
    debriefed('a', [{ text: 'Why are you leaving?', verdict: 'ok' }]),
    debriefed('b', [{ text: 'why are you leaving?', verdict: 'badly' }]),
  ])
  assert.equal(insights.recorded.length, 0)
  assert.equal(insights.offBank.length, 1)
  assert.equal(insights.offBank[0]?.count, 2)
  assert.equal(insights.offBank[0]?.struggled, 1)
})

test('a pattern is only claimed once there is enough history', () => {
  const one = buildDebriefInsights([debriefed('a', [{ questionId: 'fail-project', verdict: 'well' }])])
  assert.equal(one.patternWorthReading, false)

  const many = buildDebriefInsights(
    Array.from({ length: MIN_INTERVIEWS_FOR_PATTERN }, (_, i) =>
      debriefed(`iv${i}`, [{ questionId: 'fail-project', verdict: 'well' }]),
    ),
  )
  assert.equal(many.patternWorthReading, true)
})

test('a single question can be looked up for display', () => {
  const insights = buildDebriefInsights([debriefed('a', [{ questionId: 'fail-project', verdict: 'badly' }])])
  assert.equal(askedCount(insights, 'fail-project')?.asked, 1)
  assert.equal(askedCount(insights, 'conflict-manager'), null)
})

/* ------------------------------- theme gaps ------------------------------- */

test('themes asked about with nothing written down come first', () => {
  const insights = buildDebriefInsights([
    debriefed('a', [{ questionId: 'fail-project', verdict: 'badly' }]),
    debriefed('b', [{ questionId: 'conflict-manager', verdict: 'well' }]),
  ])
  // Conflict is written up; Failure is not, so Failure is the real gap.
  const gaps = themeGaps(insights, [story('A conflict', ['Conflict'])])
  assert.equal(gaps[0]?.tag, 'Failure')
  assert.equal(gaps[0]?.unwritten, true)
  assert.equal(gaps[0]?.struggled, 1)
  assert.equal(gaps.find((g) => g.tag === 'Conflict')?.unwritten, false)
})

test('a half-written story does not close a gap', () => {
  const insights = buildDebriefInsights([debriefed('a', [{ questionId: 'fail-project', verdict: 'ok' }])])
  const gaps = themeGaps(insights, [story('Half', ['Failure'], false)])
  assert.equal(gaps[0]?.unwritten, true)
})

/* --------------------------------- timing --------------------------------- */

test('a recent interview is due a debrief, an old one is past saving', () => {
  assert.equal(debriefIsDue(interview({ id: 'a', scheduledAt: isoDaysAgo(1) }), NOW), true)
  assert.equal(
    debriefIsDue(interview({ id: 'b', scheduledAt: isoDaysAgo(DEBRIEF_WINDOW_DAYS + 2) }), NOW),
    false,
  )
})

test('an interview that has not happened yet is not due', () => {
  const future = new Date(NOW.getTime() + 2 * 86_400_000).toISOString()
  assert.equal(debriefIsDue(interview({ id: 'a', scheduledAt: future }), NOW), false)
})

test('a completed or cancelled debrief is never asked for again', () => {
  assert.equal(debriefIsDue(interview({ id: 'a', debriefedAt: isoDaysAgo(1) }), NOW), false)
  assert.equal(debriefIsDue(interview({ id: 'b', outcome: 'cancelled' }), NOW), false)
})

/* ------------------------------- the prompt ------------------------------- */

test('the debrief offers the questions that fit the format', () => {
  const behavioural = questionsForDebrief({ type: 'behavioral' })
  assert.ok(behavioural.length > 0)
  for (const q of behavioural) assert.ok(q.formats.includes('behavioral'))
})

test('a format with nothing attributed to it still offers the whole bank', () => {
  // "other" carries no questions; an empty checklist would be useless.
  assert.equal(questionsForDebrief({ type: 'other' }).length, QUESTIONS.length)
})

test('setting a question aside does not erase a debrief that recorded it', () => {
  // Hiding says "this will not come up again", not "this never happened".
  const bank = resolveBank([], ['fail-project'])
  const insights = buildDebriefInsights(
    [debriefed('a', [{ questionId: 'fail-project', verdict: 'badly' }])],
    bank,
  )
  assert.equal(insights.recorded.length, 1)
  assert.equal(insights.recorded[0]?.question.id, 'fail-project')
})

test('a question you wrote is counted once you have been asked it', () => {
  const bank = resolveBank([
    {
      id: 'cq_1',
      text: 'Walk me through a critique you led.',
      theme: 'Leadership',
      formats: ['behavioral'],
      createdAt: isoDaysAgo(2),
      updatedAt: isoDaysAgo(2),
    },
  ])
  const insights = buildDebriefInsights(
    [debriefed('a', [{ questionId: 'cq_1', verdict: 'well' }])],
    bank,
  )
  assert.equal(insights.recorded[0]?.question.id, 'cq_1')
  assert.equal(insights.offBank.length, 0)
})
