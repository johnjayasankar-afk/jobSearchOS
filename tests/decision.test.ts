import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDecision, buildDefaultCriteria, compareDecisions } from '../src/lib/decision'
import { STARTER_SETS, starterSet } from '../src/lib/starter-questions'
import { QUESTIONS, resolveBank } from '../src/lib/questions'
import {
  INTERVIEW_TYPES,
  STORY_TAGS,
  type DecisionCriterion,
  type DecisionRating,
  type MasterProfile,
  type Opportunity,
} from '../src/lib/types'

const CRITERIA: DecisionCriterion[] = [
  { id: 'work', label: 'The work itself', weight: 3 },
  { id: 'manager', label: 'The manager', weight: 3 },
  { id: 'scope', label: 'Scope', weight: 2 },
  { id: 'hours', label: 'Hours', weight: 1 },
]

function opp(patch: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'o1',
    company: 'Acme',
    role: 'PM',
    stage: 'offer',
    priority: 'high',
    tags: [],
    currency: 'USD',
    stageHistory: [{ stage: 'offer', at: '2026-09-01T10:00:00Z' }],
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    stageChangedAt: '2026-09-01T10:00:00Z',
    ...patch,
  } as Opportunity
}

function profile(patch: Partial<MasterProfile> = {}): MasterProfile {
  return {
    id: 'master',
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
    updatedAt: '2026-08-01T10:00:00Z',
    ...patch,
  }
}

const ratings = (r: Record<string, DecisionRating>) => r

/* ------------------------------- the defaults ----------------------------- */

test('the starting criteria are distinct and carry real weights', () => {
  const built = buildDefaultCriteria()
  assert.ok(built.length >= 6)
  assert.equal(new Set(built.map((c) => c.id)).size, built.length)
  assert.equal(new Set(built.map((c) => c.label)).size, built.length)
  assert.ok(built.some((c) => c.weight === 3), 'something has to be decisive')
})

/* -------------------------------- one offer ------------------------------- */

test('decisive criteria come first, whatever order they were written in', () => {
  const decision = buildDecision(opp(), CRITERIA, null)
  assert.deepEqual(decision.decisive.map((r) => r.criterion.id), ['manager', 'work'])
  assert.equal(decision.rated[0]?.criterion.weight, 3)
})

test('a concern only counts when it is against something that matters', () => {
  const decision = buildDecision(
    opp({ decisionRatings: ratings({ hours: 'concern', manager: 'concern' }) }),
    CRITERIA,
    null,
  )
  assert.deepEqual(decision.concerns.map((r) => r.criterion.id), ['manager'])
})

test('what you have not judged yet is tracked, ignoring the nice-to-haves', () => {
  const decision = buildDecision(opp({ decisionRatings: ratings({ work: 'strength' }) }), CRITERIA, null)
  assert.deepEqual(decision.unrated.map((r) => r.criterion.id).sort(), ['manager', 'scope'])
  assert.equal(decision.complete, false)

  const done = buildDecision(
    opp({ decisionRatings: ratings({ work: 'fine', manager: 'fine', scope: 'fine' }) }),
    CRITERIA,
    null,
  )
  assert.equal(done.complete, true, 'a nice-to-have left blank should not block completeness')
})

/* --------------------------------- money ---------------------------------- */

test('the offer is placed against the minimum you set', () => {
  const decision = buildDecision(
    opp({ offer: { status: 'received', baseSalary: 150000 } }),
    CRITERIA,
    profile({ minCompensation: 170000 }),
  )
  assert.equal(decision.money.againstMinimum?.short, true)
  assert.equal(decision.money.againstMinimum?.difference, -20000)
})

test('a currency mismatch blocks the comparison rather than making one up', () => {
  const decision = buildDecision(
    opp({ currency: 'EUR', offer: { status: 'received', baseSalary: 150000, currency: 'EUR' } }),
    CRITERIA,
    profile({ minCompensation: 170000, currency: 'USD' }),
  )
  assert.equal(decision.money.currencyMismatch, true)
  assert.equal(decision.money.againstMinimum, null)
})

test('the offer is placed against the range on the record', () => {
  const below = buildDecision(
    opp({ salaryMin: 180000, salaryMax: 210000, offer: { status: 'received', baseSalary: 160000 } }),
    CRITERIA,
    null,
  )
  assert.equal(below.money.againstRange?.position, 'below')

  const within = buildDecision(
    opp({ salaryMin: 150000, salaryMax: 210000, offer: { status: 'received', baseSalary: 190000 } }),
    CRITERIA,
    null,
  )
  assert.equal(within.money.againstRange?.position, 'within')
})

test('an offer with no numbers says nothing about money', () => {
  const decision = buildDecision(opp({ offer: { status: 'received' } }), CRITERIA, profile({ minCompensation: 1 }))
  assert.equal(decision.money.againstMinimum, null)
  assert.equal(decision.money.againstRange, null)
})

/* ------------------------------- two offers ------------------------------- */

test('comparing two offers returns only what you rated differently', () => {
  const a = opp({ id: 'a', decisionRatings: ratings({ work: 'strength', manager: 'concern', scope: 'fine' }) })
  const b = opp({ id: 'b', decisionRatings: ratings({ work: 'strength', manager: 'strength', scope: 'fine' }) })
  const comparison = compareDecisions(a, b, CRITERIA)

  assert.deepEqual(comparison.differ.map((d) => d.criterion.id), ['manager'])
  assert.deepEqual(comparison.same.map((d) => d.criterion.id).sort(), ['scope', 'work'])
  assert.equal(comparison.tied, false)
})

test('differences are ordered by how much the criterion weighs', () => {
  const a = opp({ id: 'a', decisionRatings: ratings({ scope: 'strength', manager: 'concern' }) })
  const b = opp({ id: 'b', decisionRatings: ratings({ scope: 'concern', manager: 'strength' }) })
  assert.deepEqual(compareDecisions(a, b, CRITERIA).differ.map((d) => d.criterion.id), [
    'manager',
    'scope',
  ])
})

test('two offers you have rated identically are reported as tied, not ranked', () => {
  const same = ratings({ work: 'fine', manager: 'fine' })
  const comparison = compareDecisions(opp({ id: 'a', decisionRatings: same }), opp({ id: 'b', decisionRatings: same }), CRITERIA)
  assert.equal(comparison.tied, true)
  assert.equal(comparison.differ.length, 0)
})

test('a criterion neither offer has been rated on is not a difference', () => {
  const comparison = compareDecisions(opp({ id: 'a' }), opp({ id: 'b' }), CRITERIA)
  assert.equal(comparison.differ.length, 0)
  assert.equal(comparison.tied, true)
})

test('rating one side but not the other is a difference worth surfacing', () => {
  const comparison = compareDecisions(
    opp({ id: 'a', decisionRatings: ratings({ manager: 'concern' }) }),
    opp({ id: 'b' }),
    CRITERIA,
  )
  assert.deepEqual(comparison.differ.map((d) => d.criterion.id), ['manager'])
  assert.equal(comparison.differ[0]?.b, null)
})

/* ------------------------------ starter sets ------------------------------ */

test('every starter question is usable by the rest of the app', () => {
  for (const set of STARTER_SETS) {
    assert.ok(set.questions.length >= 10, `${set.id} is too thin to be a starting point`)
    for (const q of set.questions) {
      assert.ok(STORY_TAGS.includes(q.theme), `${set.id}: unknown theme ${q.theme}`)
      for (const alt of q.also ?? []) {
        assert.ok(STORY_TAGS.includes(alt), `${set.id}: unknown alternate ${alt}`)
      }
      for (const f of q.formats) {
        assert.ok((INTERVIEW_TYPES as readonly string[]).includes(f), `${set.id}: unknown format ${f}`)
      }
      assert.ok(q.formats.length > 0, `${set.id}: "${q.text}" belongs to no format`)
      assert.ok((q.listeningFor ?? '').length > 15, `${set.id}: "${q.text}" has no useful note`)
      assert.ok(q.text.trim().endsWith('?') || /^(Tell|Walk|Describe)/.test(q.text))
    }
  }
})

test('starter questions do not duplicate each other or the built-in bank', () => {
  const builtIn = new Set(QUESTIONS.map((q) => q.text.trim().toLowerCase()))
  const seen = new Set<string>()
  for (const set of STARTER_SETS) {
    for (const q of set.questions) {
      const key = q.text.trim().toLowerCase()
      assert.ok(!seen.has(key), `duplicated across sets: ${q.text}`)
      assert.ok(!builtIn.has(key), `duplicates a built-in: ${q.text}`)
      seen.add(key)
    }
  }
})

test('a starter set resolves into the bank like anything else', () => {
  const set = starterSet('engineering')
  assert.ok(set)
  const asCustom = set.questions.map((q, i) => ({
    ...q,
    id: `cq_${i}`,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
  }))
  const bank = resolveBank(asCustom)
  assert.equal(bank.length, QUESTIONS.length + set.questions.length)
  assert.ok(bank.filter((q) => q.custom).length === set.questions.length)
})
