/**
 * Deciding on an offer.
 *
 * The end of a search is the one decision that is hard to reverse, and it is
 * usually made in a week, under a deadline someone else set, on the day the
 * money arrives. Everything here exists to make that decision legible — never
 * to make it.
 *
 * There is deliberately **no total and no winner**. Adding a weight to a
 * three-point rating and calling the result 7.4 would be exactly the false
 * precision this product refuses everywhere else. What it does instead is put
 * the decisive things first, name the concerns you have already recorded
 * against them, and — when two offers are live — say where they actually
 * differ, because that is the whole decision and the rest is noise.
 */
import { computeOfferValue, type OfferValue } from './offers'
import type {
  CriterionWeight,
  DecisionCriterion,
  DecisionRating,
  MasterProfile,
  Opportunity,
} from './types'
import { newId } from './utils'

/**
 * A starting set, written to be argued with. Everyone edits these; the point is
 * that the list exists before an offer does.
 */
export const DEFAULT_CRITERIA: Array<Omit<DecisionCriterion, 'id'>> = [
  { label: 'The work itself', weight: 3 },
  { label: 'The manager', weight: 3 },
  { label: 'Scope and ownership', weight: 2 },
  { label: 'How much I would learn', weight: 2 },
  { label: 'The people I would work with', weight: 2 },
  { label: 'Compensation', weight: 2 },
  { label: 'Stability of the company', weight: 1 },
  { label: 'Hours and flexibility', weight: 1 },
]

export function buildDefaultCriteria(): DecisionCriterion[] {
  return DEFAULT_CRITERIA.map((c) => ({ ...c, id: newId('dc_') }))
}

/* -------------------------------------------------------------------------- */
/*  One offer                                                                  */
/* -------------------------------------------------------------------------- */

export interface RatedCriterion {
  criterion: DecisionCriterion
  rating: DecisionRating | null
}

export interface MoneyRead {
  value: OfferValue
  /** First-year total against the minimum on your profile, when both exist. */
  againstMinimum: { minimum: number; difference: number; short: boolean } | null
  /** First-year total against the range recorded on the opportunity. */
  againstRange: { min?: number; max?: number; position: 'below' | 'within' | 'above' } | null
  /** True when currencies differ and the comparison would be meaningless. */
  currencyMismatch: boolean
}

export interface Decision {
  rated: RatedCriterion[]
  /** Criteria you called decisive, in weight order. */
  decisive: RatedCriterion[]
  /** Concerns against anything that matters or is decisive. */
  concerns: RatedCriterion[]
  /** Things that matter and you have not judged yet. */
  unrated: RatedCriterion[]
  money: MoneyRead
  /** True once every criterion that matters has been judged. */
  complete: boolean
}

const byWeight = (a: RatedCriterion, b: RatedCriterion) =>
  b.criterion.weight - a.criterion.weight || a.criterion.label.localeCompare(b.criterion.label)

export function buildDecision(
  opportunity: Opportunity,
  criteria: DecisionCriterion[],
  profile: MasterProfile | null,
): Decision {
  const ratings = opportunity.decisionRatings ?? {}
  const rated: RatedCriterion[] = criteria
    .map((criterion) => ({ criterion, rating: ratings[criterion.id] ?? null }))
    .sort(byWeight)

  const value = computeOfferValue(opportunity.offer, opportunity.currency)
  const first = value.usable ? value.firstYear : null

  const currencyMismatch = Boolean(
    profile?.currency && value.currency && profile.currency !== value.currency,
  )

  let againstMinimum: MoneyRead['againstMinimum'] = null
  if (first !== null && profile?.minCompensation && !currencyMismatch) {
    const difference = first - profile.minCompensation
    againstMinimum = { minimum: profile.minCompensation, difference, short: difference < 0 }
  }

  let againstRange: MoneyRead['againstRange'] = null
  if (first !== null && (opportunity.salaryMin || opportunity.salaryMax)) {
    const min = opportunity.salaryMin
    const max = opportunity.salaryMax
    const position = min !== undefined && first < min ? 'below' : max !== undefined && first > max ? 'above' : 'within'
    againstRange = { min, max, position }
  }

  return {
    rated,
    decisive: rated.filter((r) => r.criterion.weight === 3),
    concerns: rated.filter((r) => r.rating === 'concern' && r.criterion.weight >= 2),
    unrated: rated.filter((r) => r.rating === null && r.criterion.weight >= 2),
    money: { value, againstMinimum, againstRange, currencyMismatch },
    complete: rated.every((r) => r.rating !== null || r.criterion.weight === 1),
  }
}

/* -------------------------------------------------------------------------- */
/*  Two offers                                                                 */
/* -------------------------------------------------------------------------- */

export interface Divergence {
  criterion: DecisionCriterion
  a: DecisionRating | null
  b: DecisionRating | null
}

export interface Comparison {
  /** Criteria you rated differently, heaviest first. */
  differ: Divergence[]
  /** Criteria you rated the same. */
  same: Divergence[]
  /** True when nothing you have judged separates them. */
  tied: boolean
}

/**
 * Where two offers actually differ.
 *
 * The useful output of comparing offers is almost never the comparison — it is
 * the short list of things you rated differently, because that list *is* the
 * decision. Everything you scored the same can be set aside.
 */
export function compareDecisions(
  a: Opportunity,
  b: Opportunity,
  criteria: DecisionCriterion[],
): Comparison {
  const ra = a.decisionRatings ?? {}
  const rb = b.decisionRatings ?? {}

  const rows: Divergence[] = criteria.map((criterion) => ({
    criterion,
    a: ra[criterion.id] ?? null,
    b: rb[criterion.id] ?? null,
  }))

  const weightOf = (d: Divergence): CriterionWeight => d.criterion.weight
  const differ = rows
    .filter((d) => d.a !== d.b && (d.a !== null || d.b !== null))
    .sort((x, y) => weightOf(y) - weightOf(x) || x.criterion.label.localeCompare(y.criterion.label))

  return {
    differ,
    same: rows.filter((d) => d.a === d.b && d.a !== null),
    tied: differ.length === 0,
  }
}
