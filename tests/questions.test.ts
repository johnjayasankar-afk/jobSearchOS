import test from 'node:test'
import assert from 'node:assert/strict'
import { QUESTIONS, buildCoverage, buildDrill, resolveBank, storiesForQuestion } from '../src/lib/questions'
import { SHARP_FOR_DAYS, rehearsalReadiness, sharpnessOf } from '../src/lib/rehearsal'
import { STORY_TAGS, type CustomQuestion, type Story, type StoryTag } from '../src/lib/types'

const NOW = new Date('2026-09-07T10:00:00')

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

function story(patch: Partial<Story> & { title: string }): Story {
  return {
    id: patch.title.toLowerCase().replace(/\W+/g, '-'),
    situation: 'A situation',
    task: 'A task',
    action: 'An action',
    result: 'A result',
    skills: [],
    tags: [],
    favorite: false,
    useCount: 0,
    rehearsalCount: 0,
    createdAt: isoDaysAgo(90),
    updatedAt: isoDaysAgo(90),
    ...patch,
  }
}

/* ------------------------------ the bank itself --------------------------- */

test('every question uses a theme the story tags actually offer', () => {
  for (const q of QUESTIONS) {
    assert.ok(STORY_TAGS.includes(q.theme), `${q.id} has unknown theme ${q.theme}`)
    for (const alt of q.also ?? []) {
      assert.ok(STORY_TAGS.includes(alt), `${q.id} has unknown alternate ${alt}`)
    }
  }
})

test('question ids are unique and every question is attributed to a format', () => {
  const ids = new Set(QUESTIONS.map((q) => q.id))
  assert.equal(ids.size, QUESTIONS.length)
  for (const q of QUESTIONS) {
    assert.ok(q.formats.length > 0, `${q.id} belongs to no interview format`)
    assert.ok(q.listeningFor.length > 20, `${q.id} has no useful note`)
  }
})

test('every theme has at least one question behind it', () => {
  for (const tag of STORY_TAGS) {
    assert.ok(
      QUESTIONS.some((q) => q.theme === tag),
      `no question covers ${tag}`,
    )
  }
})

/* -------------------------------- sharpness ------------------------------- */

test('a story that has never been rehearsed is untested', () => {
  assert.equal(sharpnessOf(story({ title: 'New' }), NOW), 'untested')
})

test('a recent good run is sharp, an old one has faded', () => {
  const recent = story({ title: 'Recent', rehearsalCount: 1, lastRehearsedAt: isoDaysAgo(3), lastRehearsalRating: 'solid' })
  const old = story({ title: 'Old', rehearsalCount: 1, lastRehearsedAt: isoDaysAgo(SHARP_FOR_DAYS + 5), lastRehearsalRating: 'solid' })
  assert.equal(sharpnessOf(recent, NOW), 'sharp')
  assert.equal(sharpnessOf(old, NOW), 'fading')
})

test('a rough run reads as needing work however recent it was', () => {
  const rough = story({ title: 'Rough', rehearsalCount: 4, lastRehearsedAt: isoDaysAgo(0), lastRehearsalRating: 'shaky' })
  assert.equal(sharpnessOf(rough, NOW), 'shaky')
})

/* -------------------------------- coverage -------------------------------- */

test('one finished story is thin; two give the theme depth', () => {
  const coverage = buildCoverage([
    story({ title: 'Whole', tags: ['Leadership'] }),
    story({ title: 'Half', tags: ['Conflict'], result: undefined }),
    story({ title: 'Deep one', tags: ['Growth'] }),
    story({ title: 'Deep two', tags: ['Growth'] }),
  ])
  const byTag = (tag: string) => coverage.themes.find((t) => t.tag === tag)

  // One finished story answers a question, but not two on the same theme.
  assert.equal(byTag('Leadership')?.state, 'thin')
  assert.equal(byTag('Leadership')?.ready.length, 1)
  assert.equal(byTag('Growth')?.state, 'ready')
  assert.equal(byTag('Conflict')?.state, 'thin')
  assert.equal(byTag('Conflict')?.drafts.length, 1)
  assert.equal(byTag('Conflict')?.ready.length, 0)
  assert.equal(byTag('Failure')?.state, 'uncovered')
})

test('themes resting on a single story are called out separately', () => {
  const coverage = buildCoverage([
    story({ title: 'Only one', tags: ['Leadership'] }),
    story({ title: 'Deep one', tags: ['Growth'] }),
    story({ title: 'Deep two', tags: ['Growth'] }),
  ])
  assert.deepEqual(coverage.singleStory.map((t) => t.tag), ['Leadership'])
})

test('a single finished story still makes its questions answerable', () => {
  // Depth changes how a theme is *described*, never whether you have an answer.
  const coverage = buildCoverage([story({ title: 'Only one', tags: ['Leadership'] })])
  assert.ok(!coverage.unanswerable.some((q) => q.theme === 'Leadership'))
})

test('coverage counts add up to the full set of themes', () => {
  const coverage = buildCoverage([story({ title: 'One', tags: ['Growth'] })])
  assert.equal(
    coverage.readyCount + coverage.thinCount + coverage.uncoveredCount,
    STORY_TAGS.length,
  )
})

test('an empty bank leaves every question unanswerable', () => {
  const coverage = buildCoverage([])
  assert.equal(coverage.unanswerable.length, QUESTIONS.length)
  assert.equal(coverage.readyCount, 0)
})

test('an alternate theme is enough to answer a question', () => {
  const conflictQuestion = QUESTIONS.find((q) => q.id === 'conflict-manager')
  assert.ok(conflictQuestion)
  assert.deepEqual(conflictQuestion.also, ['Stakeholders'])

  const viaAlternate = storiesForQuestion(conflictQuestion, [story({ title: 'Via alt', tags: ['Stakeholders'] })])
  assert.equal(viaAlternate.length, 1)
})

test('a half-written story does not make a question answerable', () => {
  const coverage = buildCoverage([story({ title: 'Draft', tags: ['Leadership'], action: undefined })])
  assert.ok(coverage.unanswerable.some((q) => q.theme === 'Leadership'))
})

/* ---------------------------------- drill --------------------------------- */

test('the drill pairs each question with the story that most needs the practice', () => {
  const sharp = story({
    title: 'Sharp one',
    tags: ['Failure'],
    rehearsalCount: 3,
    lastRehearsedAt: isoDaysAgo(1),
    lastRehearsalRating: 'solid',
  })
  const untested = story({ title: 'Untested one', tags: ['Failure'] })

  const drill = buildDrill([sharp, untested], { themes: ['Failure'], now: NOW })
  const first = drill.find((item) => item.story)
  assert.ok(first)
  assert.equal(first.story?.title, 'Untested one')
  assert.ok(first.alternates.some((s) => s.title === 'Sharp one'))
})

test('questions you can answer come before ones you cannot', () => {
  const drill = buildDrill([story({ title: 'Only one', tags: ['Failure'] })], { limit: 20, now: NOW })
  const firstUnanswerable = drill.findIndex((item) => !item.story)
  const lastAnswerable = drill.map((item) => Boolean(item.story)).lastIndexOf(true)
  if (firstUnanswerable !== -1 && lastAnswerable !== -1) {
    assert.ok(lastAnswerable < firstUnanswerable, 'answerable questions should be sorted first')
  }
})

test('filtering by interview format only returns questions asked in it', () => {
  const drill = buildDrill([], { formats: ['technical'], limit: 50, now: NOW })
  assert.ok(drill.length > 0)
  for (const item of drill) {
    assert.ok(item.question.formats.includes('technical'))
  }
})

test('a question you struggled with in a real interview comes first', () => {
  // Self-assessment loses to evidence: an interviewer finding the hole beats a
  // story you told yourself went fine.
  const sharp = story({
    title: 'Sharp leadership',
    tags: ['Leadership'],
    rehearsalCount: 3,
    lastRehearsedAt: isoDaysAgo(1),
    lastRehearsalRating: 'solid',
  })
  const untested = story({ title: 'Untested failure', tags: ['Failure'] })

  const withoutEvidence = buildDrill([sharp, untested], { limit: 20, now: NOW })
  const withEvidence = buildDrill([sharp, untested], {
    limit: 20,
    now: NOW,
    struggled: ['lead-developed'],
  })

  assert.equal(withEvidence[0]?.question.id, 'lead-developed')
  assert.notEqual(withoutEvidence[0]?.question.id, 'lead-developed')
})

test('the drill respects its limit', () => {
  assert.equal(buildDrill([], { limit: 3, now: NOW }).length, 3)
})

/* ------------------------------- readiness -------------------------------- */

test('readiness counts only the stories actually pinned to the interview', () => {
  const pinned = story({
    title: 'Pinned',
    rehearsalCount: 2,
    lastRehearsedAt: isoDaysAgo(2),
    lastRehearsalRating: 'solid',
  })
  const rough = story({ title: 'Rough', rehearsalCount: 1, lastRehearsedAt: isoDaysAgo(2), lastRehearsalRating: 'shaky' })
  const unrelated = story({ title: 'Unrelated' })

  const readiness = rehearsalReadiness([pinned.id, rough.id], [pinned, rough, unrelated], NOW)
  assert.equal(readiness.total, 2)
  assert.equal(readiness.sharp, 1)
  assert.deepEqual(readiness.needWork.map((s) => s.title), ['Rough'])
})

test('a missing story reference is ignored rather than counted', () => {
  const readiness = rehearsalReadiness(['does-not-exist'], [story({ title: 'A' })], NOW)
  assert.equal(readiness.total, 0)
  assert.equal(readiness.needWork.length, 0)
})

/* ------------------------------ your own bank ----------------------------- */

function custom(patch: Partial<CustomQuestion> & { id: string; text: string; theme: StoryTag }) {
  return {
    formats: ['behavioral' as const],
    createdAt: isoDaysAgo(1),
    updatedAt: isoDaysAgo(1),
    ...patch,
  }
}

test('the resolved bank is the built-ins plus your own', () => {
  const bank = resolveBank([custom({ id: 'cq_1', text: 'Walk me through a critique you led.', theme: 'Leadership' })])
  assert.equal(bank.length, QUESTIONS.length + 1)
  const mine = bank.find((q) => q.id === 'cq_1')
  assert.equal(mine?.custom, true)
  assert.equal(bank.find((q) => q.id === 'fail-project')?.custom, undefined)
})

test('a question set aside drops out of the bank', () => {
  const bank = resolveBank([], ['fail-project'])
  assert.equal(bank.length, QUESTIONS.length - 1)
  assert.ok(!bank.some((q) => q.id === 'fail-project'))
})

test('a custom question with no note still reads as a question', () => {
  const [mine] = resolveBank([custom({ id: 'cq_1', text: 'Anything?', theme: 'Growth' })]).slice(-1)
  assert.ok(mine)
  assert.ok(mine.listeningFor.length > 0)
})

test('your own question counts in coverage like any other', () => {
  const bank = resolveBank([custom({ id: 'cq_1', text: 'A design question', theme: 'Technical' })])
  const withStory = buildCoverage([story({ title: 'Tech story', tags: ['Technical'] })], bank)
  assert.ok(!withStory.unanswerable.some((q) => q.id === 'cq_1'))

  const without = buildCoverage([], bank)
  assert.ok(without.unanswerable.some((q) => q.id === 'cq_1'))
})

test('setting a question aside removes it from the unanswerable list', () => {
  const all = buildCoverage([], resolveBank([]))
  const fewer = buildCoverage([], resolveBank([], ['fail-project']))
  assert.equal(fewer.unanswerable.length, all.unanswerable.length - 1)
})

test('your own question can be drilled', () => {
  const bank = resolveBank([custom({ id: 'cq_1', text: 'A design question', theme: 'Technical' })])
  const drill = buildDrill([story({ title: 'Tech story', tags: ['Technical'] })], {
    bank,
    themes: ['Technical'],
    limit: 20,
    now: NOW,
  })
  const mine = drill.find((item) => item.question.id === 'cq_1')
  assert.ok(mine, 'a custom question should appear in its own theme drill')
  assert.equal(mine.story?.title, 'Tech story')
})
