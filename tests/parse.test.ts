import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractSalary,
  extractYears,
  extractArrangement,
  extractLocation,
  parseJobDescription,
  guessFromUrl,
  annualize,
} from '../src/lib/parse'

test('salary: dollar range with commas', () => {
  const r = extractSalary('Base salary range: $185,000 - $215,000 plus equity.')
  assert.equal(r?.min, 185000)
  assert.equal(r?.max, 215000)
  assert.equal(r?.currency, 'USD')
  assert.equal(r?.period, 'year')
})

test('salary: k-notation with en dash and euros', () => {
  const r = extractSalary('We offer €110k–€135k depending on experience.')
  assert.equal(r?.min, 110000)
  assert.equal(r?.max, 135000)
  assert.equal(r?.currency, 'EUR')
})

test('salary: currency code after the range', () => {
  const r = extractSalary('Compensation is 95,000 to 120,000 USD annually.')
  assert.equal(r?.min, 95000)
  assert.equal(r?.max, 120000)
  assert.equal(r?.currency, 'USD')
})

test('salary: hourly rates are recognised and annualised', () => {
  const r = extractSalary('This contract pays $65 - $80 per hour.')
  assert.equal(r?.period, 'hour')
  assert.equal(r?.min, 65)
  const annual = annualize(r!)
  assert.equal(annual.min, 135200)
})

test('salary: 401k is not mistaken for compensation', () => {
  const r = extractSalary('Benefits include a 401k match and unlimited PTO.')
  assert.equal(r, null)
})

test('salary: no figure returns null', () => {
  assert.equal(extractSalary('Competitive salary and great benefits.'), null)
})

test('years: plus notation', () => {
  const r = extractYears('6+ years of product management experience')
  assert.equal(r?.min, 6)
})

test('years: explicit range', () => {
  const r = extractYears('We are looking for 3-5 years of experience.')
  assert.equal(r?.min, 3)
  assert.equal(r?.max, 5)
})

test('years: "at least seven years" spelled out', () => {
  const r = extractYears('Candidates should have at least seven years in the field.')
  assert.equal(r?.min, 7)
})

test('arrangement: hybrid beats a bare mention of remote', () => {
  assert.equal(extractArrangement('Hybrid role, 3 days per week in office. Remote Fridays.'), 'hybrid')
  assert.equal(extractArrangement('This position is fully remote.'), 'remote')
  assert.equal(extractArrangement('You will work on-site at our HQ.'), 'onsite')
  assert.equal(extractArrangement('No details given.'), null)
})

test('location: explicit label wins', () => {
  const r = extractLocation('Team: Platform\nLocation: Brooklyn, NY\nStart: ASAP')
  assert.equal(r.location, 'Brooklyn, NY')
})

test('location: known city with region', () => {
  const r = extractLocation('Our office is in Austin, TX and we love it here.')
  assert.equal(r.location, 'Austin, TX')
})

test('full parse splits required from preferred skills', () => {
  const jd = `Product Manager, Payments

Requirements
- Strong SQL and Python
- Experience with A/B Testing

Nice to have
- Familiarity with Looker
- Exposure to Machine Learning

Location: New York, NY. Hybrid, 3 days per week in office. $185,000 - $215,000.`
  const parsed = parseJobDescription(jd)
  assert.ok(parsed.requiredSkills.includes('SQL'))
  assert.ok(parsed.requiredSkills.includes('A/B Testing'))
  assert.ok(parsed.preferredSkills.includes('Machine Learning'))
  assert.ok(!parsed.requiredSkills.includes('Machine Learning'))
  assert.ok(parsed.tools.includes('Looker'))
  assert.equal(parsed.arrangement, 'hybrid')
  assert.equal(parsed.salary?.min, 185000)
  assert.equal(parsed.location, 'New York, NY')
  assert.ok(parsed.wordCount > 20)
})

test('empty description parses without throwing', () => {
  const parsed = parseJobDescription('')
  assert.equal(parsed.salary, null)
  assert.equal(parsed.requiredSkills.length, 0)
  assert.equal(parsed.wordCount, 0)
})

test('url guessing reads greenhouse-style boards', () => {
  const g = guessFromUrl('https://boards.greenhouse.io/northwindlabs/jobs/senior-product-manager-payments')
  assert.equal(g.company, 'Northwindlabs')
  assert.equal(g.role, 'Senior Product Manager Payments')
})

test('url guessing does not invent a company for aggregators', () => {
  const g = guessFromUrl('https://www.linkedin.com/jobs/view/123456')
  assert.equal(g.company, undefined)
})
