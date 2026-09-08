import test from 'node:test'
import assert from 'node:assert/strict'
import { computeFit, detectSeniority } from '../src/lib/fit'
import type { MasterProfile, Opportunity } from '../src/lib/types'

const profile: MasterProfile = {
  id: 'master',
  targetRoles: ['Senior Product Manager'],
  seniority: 'senior',
  yearsExperience: 8,
  skills: ['SQL', 'Product Strategy', 'A/B Testing', 'Product Analytics'],
  tools: ['Amplitude', 'Looker'],
  domains: ['Fintech', 'AI'],
  industries: ['Fintech'],
  companyTypes: [],
  locations: ['New York, NY'],
  remotePreference: 'hybrid',
  willingToRelocate: false,
  minCompensation: 180000,
  currency: 'USD',
  desiredKeywords: ['platform'],
  undesiredKeywords: ['five days in office'],
  updatedAt: new Date().toISOString(),
}

const baseOpportunity = (over: Partial<Opportunity> = {}): Opportunity => ({
  id: 'o1',
  company: 'Halcyon Pay',
  role: 'Senior Product Manager, Payments Platform',
  workArrangement: 'hybrid',
  currency: 'USD',
  dateDiscovered: '2026-01-01',
  stage: 'saved',
  priority: 'medium',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  stageChangedAt: '2026-01-01T00:00:00.000Z',
  stageHistory: [{ stage: 'saved', at: '2026-01-01T00:00:00.000Z' }],
  ...over,
})

test('an empty profile disables scoring rather than inventing a number', () => {
  const empty: MasterProfile = {
    ...profile,
    targetRoles: [],
    skills: [],
    domains: [],
    industries: [],
    locations: [],
    minCompensation: undefined,
  }
  const result = computeFit(baseOpportunity(), empty)
  assert.equal(result.score, null)
  assert.ok(result.improveHints.length > 0)
})

test('a strong match scores high with high confidence', () => {
  const result = computeFit(
    baseOpportunity({
      location: 'New York, NY',
      salaryMin: 185000,
      salaryMax: 215000,
      jobDescription:
        'We need 6+ years of product management experience. Strong SQL, Product Analytics and A/B Testing. Fintech payments platform team. Familiarity with Looker and Amplitude.',
    }),
    profile,
  )
  assert.ok(result.score !== null && result.score >= 80, `expected >= 80, got ${result.score}`)
  assert.equal(result.confidence, 'high')
  assert.ok(result.matches.some((m) => m.includes('Senior Product Manager')))
})

test('a mismatched role and low pay scores low', () => {
  const result = computeFit(
    baseOpportunity({
      role: 'Warehouse Operations Supervisor',
      company: 'Ridgeline Freight',
      location: 'Denver, CO',
      workArrangement: 'onsite',
      salaryMin: 70000,
      salaryMax: 85000,
      jobDescription:
        'Supervise a shift of 40 warehouse associates. Forklift certification required. 2+ years of warehouse experience.',
    }),
    profile,
  )
  assert.ok(result.score !== null && result.score < 45, `expected < 45, got ${result.score}`)
})

test('missing data lowers coverage instead of silently scoring zero', () => {
  const withJd = computeFit(
    baseOpportunity({
      location: 'New York, NY',
      salaryMin: 190000,
      jobDescription:
        'Requirements: SQL, A/B Testing, Product Analytics. Fintech. 6+ years of experience.',
    }),
    profile,
  )
  const withoutJd = computeFit(baseOpportunity({ location: 'New York, NY' }), profile)
  assert.ok(withoutJd.coverage < withJd.coverage)
  assert.ok(withoutJd.components.some((c) => c.id === 'skills' && c.status === 'unknown'))
  // Skills is unknown, so it must not be counted as zero points.
  assert.ok(withoutJd.score !== null && withoutJd.score > 40)
})

test('low coverage is labelled provisional', () => {
  const thin: MasterProfile = { ...profile, skills: [], tools: [], domains: [], industries: [], minCompensation: undefined, desiredKeywords: [], undesiredKeywords: [] }
  const result = computeFit(baseOpportunity(), thin)
  assert.equal(result.confidence, 'low')
  assert.match(result.band, /provisional/)
})

test('an undesired keyword is reported as a gap', () => {
  const result = computeFit(
    baseOpportunity({
      jobDescription: 'This role requires five days in office. SQL and Product Analytics required.',
      location: 'New York, NY',
      salaryMin: 200000,
    }),
    profile,
  )
  assert.ok(result.gaps.some((g) => g.includes('five days in office')))
})

test('seniority gaps are explained, not hidden', () => {
  const junior: MasterProfile = { ...profile, seniority: 'junior', yearsExperience: 2 }
  const result = computeFit(
    baseOpportunity({ jobDescription: 'We require 10+ years of experience leading platform teams.' }),
    junior,
  )
  const seniority = result.components.find((c) => c.id === 'seniority')
  assert.ok(seniority?.gaps.some((g) => g.includes('10+ years')))
})

test('seniority detection reads common title patterns', () => {
  assert.equal(detectSeniority('Senior Product Manager'), 'senior')
  assert.equal(detectSeniority('Staff Software Engineer'), 'staff')
  assert.equal(detectSeniority('Director of Product'), 'director')
  assert.equal(detectSeniority('VP of Engineering'), 'vp')
  assert.equal(detectSeniority('Product Manager'), null)
})

test('scores stay inside 0..100 for adversarial inputs', () => {
  const weird = computeFit(
    baseOpportunity({ role: '', company: '', jobDescription: 'x'.repeat(5000) }),
    profile,
  )
  assert.ok(weird.score === null || (weird.score >= 0 && weird.score <= 100))
})
