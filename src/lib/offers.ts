/**
 * Offer arithmetic.
 *
 * This is the sum a candidate would otherwise do badly in a spreadsheet at
 * eleven at night: what the first year is actually worth, what the steady state
 * is once the signing bonus is gone, and what the whole grant adds up to.
 *
 * It is arithmetic and nothing else. There is no market data, no benchmark and
 * no advice — and where a figure has not been entered, the total says so rather
 * than treating the gap as a zero.
 */
import type { OfferInfo, Opportunity } from './types'

export const DEFAULT_VESTING_YEARS = 4

export interface OfferComponent {
  label: string
  /** Value in the first year. */
  firstYear: number
  /** Value in a typical later year, once one-off payments are gone. */
  steadyYear: number
  /** Value across the whole vesting period. */
  total: number
}

export interface OfferValue {
  currency: string
  years: number
  components: OfferComponent[]
  firstYear: number
  steadyYear: number
  total: number
  /** Figures that were not entered, so the totals can be read honestly. */
  missing: string[]
  /** False when there is not even a base salary to work from. */
  usable: boolean
}

export function computeOfferValue(offer: OfferInfo | undefined, fallbackCurrency = 'USD'): OfferValue {
  const currency = offer?.currency ?? fallbackCurrency
  const years = offer?.equityYears && offer.equityYears > 0 ? offer.equityYears : DEFAULT_VESTING_YEARS
  const components: OfferComponent[] = []
  const missing: string[] = []

  const base = offer?.baseSalary
  if (base && base > 0) {
    components.push({ label: 'Base salary', firstYear: base, steadyYear: base, total: base * years })
  } else {
    missing.push('base salary')
  }

  const bonus = offer?.bonus
  if (bonus && bonus > 0) {
    components.push({ label: 'Target bonus', firstYear: bonus, steadyYear: bonus, total: bonus * years })
  } else {
    missing.push('bonus')
  }

  const signOn = offer?.signOn
  if (signOn && signOn > 0) {
    // A one-off: it lifts the first year and nothing after it.
    components.push({ label: 'Sign-on', firstYear: signOn, steadyYear: 0, total: signOn })
  }

  const equityValue = offer?.equityValue
  if (equityValue && equityValue > 0) {
    const perYear = equityValue / years
    components.push({
      label: `Equity (over ${years} ${years === 1 ? 'year' : 'years'})`,
      firstYear: perYear,
      steadyYear: perYear,
      total: equityValue,
    })
  } else if (offer?.equity) {
    // Described but not valued — say so instead of pretending it is worth zero.
    missing.push('a value for the equity')
  } else {
    missing.push('equity')
  }

  const sum = (pick: (c: OfferComponent) => number) => components.reduce((a, c) => a + pick(c), 0)

  return {
    currency,
    years,
    components,
    firstYear: sum((c) => c.firstYear),
    steadyYear: sum((c) => c.steadyYear),
    total: sum((c) => c.total),
    missing,
    usable: components.length > 0,
  }
}

/** Opportunities carrying an offer, newest first. */
export function offersInPlay(opportunities: Opportunity[]): Opportunity[] {
  return opportunities
    .filter((o) => o.offer && !o.archivedAt)
    .sort((a, b) => (b.offer?.date ?? '').localeCompare(a.offer?.date ?? ''))
}

/**
 * A plain-language note about how comparable two totals are. Comparing across
 * currencies without a rate is meaningless, and saying so beats a wrong number.
 */
export function comparabilityNote(values: OfferValue[]): string | null {
  const currencies = [...new Set(values.map((v) => v.currency))]
  if (currencies.length > 1) {
    return `These offers are in different currencies (${currencies.join(', ')}). Opportunity OS does not convert them — compare them yourself.`
  }
  const anyMissing = values.some((v) => v.missing.length > 0)
  if (anyMissing) return 'Some figures are missing, so these totals are floors rather than final numbers.'
  return null
}
