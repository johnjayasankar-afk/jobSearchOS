import test from 'node:test'
import assert from 'node:assert/strict'
import { fuzzyMatch, fuzzyScore, highlightSegments } from '../src/lib/fuzzy'

test('an exact substring matches and reports its positions', () => {
  const m = fuzzyMatch('pay', 'Halcyon Pay')
  assert.ok(m)
  assert.deepEqual(m.indices, [8, 9, 10])
})

test('initials find a multi-word name', () => {
  const m = fuzzyMatch('hp', 'Halcyon Pay')
  assert.ok(m)
  assert.deepEqual(m.indices, [0, 8])
})

test('dropped vowels still match', () => {
  assert.ok(fuzzyMatch('hlcn', 'Halcyon Pay'))
  assert.ok(fuzzyMatch('wkrv', 'Weekly review'))
})

test('a non-subsequence does not match', () => {
  assert.equal(fuzzyMatch('zzz', 'Halcyon Pay'), null)
  assert.equal(fuzzyMatch('yap', 'Halcyon Pay'), null)
})

test('a prefix outranks a match in the middle', () => {
  const prefix = fuzzyMatch('hal', 'Halcyon Pay')
  const middle = fuzzyMatch('hal', 'The Great Halcyon')
  assert.ok(prefix && middle)
  assert.ok(prefix.score > middle.score)
})

test('a word start outranks a mid-word match', () => {
  const wordStart = fuzzyMatch('pay', 'Halcyon Pay')
  const midWord = fuzzyMatch('pay', 'Repayment Systems')
  assert.ok(wordStart && midWord)
  assert.ok(wordStart.score > midWord.score)
})

test('an empty query matches everything with no highlight', () => {
  const m = fuzzyMatch('', 'anything')
  assert.deepEqual(m, { score: 0, indices: [] })
})

test('every word of a query must match somewhere', () => {
  const fields = { title: 'Halcyon Pay', subtitle: 'Senior Product Manager', keywords: 'fintech onsite' }
  assert.ok(fuzzyScore('halcyon manager', fields))
  assert.ok(fuzzyScore('halcyon fintech', fields))
  assert.equal(fuzzyScore('halcyon zebra', fields), null)
})

test('a title hit outranks the same hit in hidden keywords', () => {
  const inTitle = fuzzyScore('fintech', { title: 'Fintech Co', keywords: 'other' })
  const inKeywords = fuzzyScore('fintech', { title: 'Other Co', keywords: 'fintech' })
  assert.ok(inTitle && inKeywords)
  assert.ok(inTitle.score > inKeywords.score)
})

test('highlight segments reconstruct the original string', () => {
  const segments = highlightSegments('Halcyon Pay', [0, 1, 2])
  assert.equal(segments.map((s) => s.text).join(''), 'Halcyon Pay')
  assert.equal(segments[0]?.match, true)
  assert.equal(segments[0]?.text, 'Hal')
  assert.equal(segments[1]?.match, false)
})

test('highlighting nothing returns the string unchanged', () => {
  assert.deepEqual(highlightSegments('Halcyon', []), [{ text: 'Halcyon', match: false }])
})

test('a repeated letter later in the string does not starve the rest of the query', () => {
  // Regression: greedily taking the *last* occurrence of a letter left nothing
  // for the characters after it, so real matches came back empty.
  const halcyon = fuzzyMatch('hlcn', 'Halcyon Pay — Senior Product Manager, Payments Platform')
  assert.ok(halcyon, 'hlcn should match Halcyon Pay')
  assert.deepEqual(halcyon.indices, [0, 2, 3, 6])

  assert.ok(fuzzyMatch('lld', 'hello world'))
  assert.ok(fuzzyMatch('rot', 'Product Roadmap'))
})

test('the tightest match ranks above letters scattered across words', () => {
  const tight = fuzzyMatch('hlcn', 'Halcyon Pay — Senior Product Manager, Payments Platform')
  const scattered = fuzzyMatch('hlcn', 'Cobalt Health — Group Product Manager, Care Navigation')
  assert.ok(tight && scattered)
  assert.ok(tight.score > scattered.score)
})
