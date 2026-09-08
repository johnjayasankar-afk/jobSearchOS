/**
 * Deterministic job-description parsing.
 *
 * Everything here is regex and string matching that runs locally in the browser.
 * There is no model, no inference and no network request. Results are presented
 * to the user as *editable suggestions*, never as facts.
 */
import { VOCABULARY, type VocabEntry } from './skills-dictionary'
import { normalize, uniq } from './utils'
import type { WorkArrangement } from './types'

export interface SalaryFinding {
  min?: number
  max?: number
  currency: string
  /** How the figure was stated in the posting. */
  period: 'year' | 'month' | 'hour'
  /** The matched source text, shown so the user can verify the suggestion. */
  evidence: string
}

export interface YearsFinding {
  min: number
  max?: number
  evidence: string
}

export interface ParsedJobDescription {
  salary: SalaryFinding | null
  years: YearsFinding | null
  location: string | null
  arrangement: WorkArrangement | null
  requiredSkills: string[]
  preferredSkills: string[]
  domains: string[]
  tools: string[]
  /** Distinct capitalised phrases that look like a role title. */
  roleHints: string[]
  /** Sentences that mention location, kept as evidence for the suggestion. */
  locationEvidence: string[]
  wordCount: number
}

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  $: 'USD',
  '£': 'GBP',
  '€': 'EUR',
  '₹': 'INR',
  '¥': 'JPY',
}

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'SGD', 'CHF', 'JPY']

function toNumber(raw: string): number {
  const cleaned = raw.replace(/[,\s]/g, '')
  const kMatch = /^(\d+(?:\.\d+)?)k$/i.exec(cleaned)
  if (kMatch?.[1]) return Math.round(Number(kMatch[1]) * 1000)
  return Math.round(Number(cleaned))
}

/**
 * Finds a compensation range. Handles `$120,000 - $160,000`, `$120k–$160k`,
 * `USD 95000 to 120000`, `£70k+` and hourly/monthly statements.
 */
export function extractSalary(text: string): SalaryFinding | null {
  if (!text) return null
  const amount = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?k|\d{2,7})`
  const sym = String.raw`([$£€₹¥])`
  const patterns: Array<{ re: RegExp; kind: 'range' | 'single' }> = [
    // $120,000 - $160,000 / £70k–£90k
    { re: new RegExp(`${sym}\\s?${amount}\\s*(?:-|–|—|to)\\s*${sym}?\\s?${amount}`, 'i'), kind: 'range' },
    // 120,000 - 160,000 USD
    { re: new RegExp(`${amount}\\s*(?:-|–|—|to)\\s*${amount}\\s*(${CURRENCY_CODES.join('|')})`, 'i'), kind: 'range' },
    // USD 120,000 - 160,000
    { re: new RegExp(`(${CURRENCY_CODES.join('|')})\\s*${amount}\\s*(?:-|–|—|to)\\s*${amount}`, 'i'), kind: 'range' },
    // $150,000+ / £70k
    { re: new RegExp(`${sym}\\s?${amount}`, 'i'), kind: 'single' },
  ]

  for (const { re, kind } of patterns) {
    const m = re.exec(text)
    if (!m) continue
    const evidence = m[0].trim()
    const groups = m.slice(1).filter((g): g is string => Boolean(g))
    const currency =
      groups.map((g) => CURRENCY_BY_SYMBOL[g]).find(Boolean) ??
      groups.map((g) => (CURRENCY_CODES.includes(g.toUpperCase()) ? g.toUpperCase() : undefined)).find(Boolean) ??
      'USD'
    const numbers = groups
      .filter((g) => /\d/.test(g))
      .map(toNumber)
      .filter((n) => Number.isFinite(n) && n > 0)
    if (numbers.length === 0) continue

    const context = text.slice(Math.max(0, m.index - 60), m.index + evidence.length + 60).toLowerCase()
    const period: SalaryFinding['period'] = /per hour|hourly|\/\s?hr|an hour/.test(context)
      ? 'hour'
      : /per month|monthly|\/\s?mo/.test(context)
        ? 'month'
        : 'year'

    // Reject noise like "401k" or "$50 gift card": each period has a band of
    // figures a real posting could plausibly state.
    const plausible = numbers.filter((n) =>
      period === 'hour' ? n >= 5 && n <= 2000 : period === 'month' ? n >= 500 && n <= 200_000 : n >= 10_000 && n <= 5_000_000,
    )
    if (plausible.length === 0) continue

    if (kind === 'range' && plausible.length >= 2) {
      const [a, b] = [plausible[0] as number, plausible[1] as number]
      return { min: Math.min(a, b), max: Math.max(a, b), currency, period, evidence }
    }
    return { min: plausible[0], currency, period, evidence }
  }
  return null
}

/** Normalises an hourly/monthly finding to an annual figure. */
export function annualize(finding: SalaryFinding): { min?: number; max?: number } {
  const factor = finding.period === 'hour' ? 2080 : finding.period === 'month' ? 12 : 1
  return {
    min: finding.min === undefined ? undefined : Math.round(finding.min * factor),
    max: finding.max === undefined ? undefined : Math.round(finding.max * factor),
  }
}

/** Finds "5+ years of experience", "3-5 years", "minimum of seven years". */
export function extractYears(text: string): YearsFinding | null {
  if (!text) return null
  const WORD_NUMBERS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15,
  }
  const patterns = [
    /(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*\+?\s*years?/i,
    /(\d{1,2})\s*\+\s*years?/i,
    /(?:at least|minimum(?: of)?|min\.?|over)\s*(\d{1,2})\s*years?/i,
    /(\d{1,2})\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|industry\s+)?experience/i,
    new RegExp(`(?:at least|minimum(?: of)?)\\s*(${Object.keys(WORD_NUMBERS).join('|')})\\s*years?`, 'i'),
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (!m) continue
    const first = m[1] ?? ''
    const min = WORD_NUMBERS[first.toLowerCase()] ?? Number(first)
    if (!Number.isFinite(min) || min <= 0 || min > 40) continue
    const second = m[2]
    const max = second ? Number(second) : undefined
    return {
      min,
      max: max && max > min && max <= 40 ? max : undefined,
      evidence: m[0].trim(),
    }
  }
  return null
}

const REMOTE_RE = /\b(fully remote|100% remote|remote[- ]first|work from home|wfh|remote)\b/i
const HYBRID_RE = /\b(hybrid|(\d)\s*days?\s*(?:per week\s*)?in[- ]office|in[- ]office\s*\d\s*days?)\b/i
const ONSITE_RE = /\b(on[- ]?site|in[- ]person|in[- ]office only)\b/i

export function extractArrangement(text: string): WorkArrangement | null {
  if (!text) return null
  if (HYBRID_RE.test(text)) return 'hybrid'
  if (REMOTE_RE.test(text)) return 'remote'
  if (ONSITE_RE.test(text)) return 'onsite'
  return null
}

const CITY_STATE_RE =
  /\b([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,2}),\s*(?:([A-Z]{2})\b|([A-Z][a-z]+(?:\s[A-Z][a-z]+)?))/g

const KNOWN_CITIES = [
  'New York', 'San Francisco', 'Seattle', 'Austin', 'Boston', 'Chicago', 'Denver', 'Los Angeles',
  'London', 'Berlin', 'Amsterdam', 'Dublin', 'Paris', 'Toronto', 'Vancouver', 'Sydney', 'Melbourne',
  'Singapore', 'Bengaluru', 'Bangalore', 'Mumbai', 'Tokyo', 'Zurich', 'Stockholm', 'Copenhagen',
  'Atlanta', 'Miami', 'Dallas', 'Portland', 'San Diego', 'Washington', 'Philadelphia', 'Remote',
]

/** Abbreviations whose full stop is part of the place name, not a sentence end. */
const LOCATION_ABBREVIATIONS = new Set(['st', 'ste', 'mt', 'ft', 'pt', 'no'])

/**
 * Trims a labelled location down to the place itself. Postings routinely write
 * "Location: New York, NY. Hybrid, 3 days per week." — everything after the
 * sentence break is not a location.
 */
export function tidyLocation(raw: string): string {
  let value = raw.trim()
  // Cut at a sentence break, keeping "St. Louis" style abbreviations intact.
  const sentence = /\.\s+(?=[A-Z(])/g
  let match: RegExpExecArray | null
  while ((match = sentence.exec(value)) !== null) {
    const before = value.slice(0, match.index).split(/[\s,]+/).pop() ?? ''
    if (LOCATION_ABBREVIATIONS.has(before.toLowerCase())) continue
    value = value.slice(0, match.index)
    break
  }
  // Cut at separators that introduce non-location detail.
  value = (value.split(/\s+[|•·]\s+|\s+[-–—]\s+/)[0] ?? value).trim()
  value = value.replace(/[.,;:]+$/, '').trim()
  return value.length > 64 ? `${value.slice(0, 63).trimEnd()}…` : value
}

export function extractLocation(text: string): { location: string | null; evidence: string[] } {
  if (!text) return { location: null, evidence: [] }
  const evidence: string[] = []
  const lines = text.split(/\n+/)
  for (const line of lines) {
    if (/\b(location|based in|office|headquarter|hq|remote|hybrid|on-?site)\b/i.test(line) && line.length < 220) {
      evidence.push(line.trim())
    }
  }

  // Prefer an explicit "Location: ..." label.
  const labeled = /(?:^|\n)\s*location\s*[:\-–]\s*([^\n]{2,120})/i.exec(text)
  if (labeled?.[1]) {
    return { location: tidyLocation(labeled[1]), evidence: uniq(evidence).slice(0, 4) }
  }

  const head = text.slice(0, 1200)
  for (const city of KNOWN_CITIES) {
    const re = new RegExp(`\\b${city}\\b`, 'i')
    if (re.test(head)) {
      const withRegion = new RegExp(`\\b(${city}),\\s*([A-Z]{2}|[A-Z][a-z]+)`, 'i').exec(head)
      return {
        location: withRegion ? `${withRegion[1]}, ${withRegion[2]}` : city,
        evidence: uniq(evidence).slice(0, 4),
      }
    }
  }

  CITY_STATE_RE.lastIndex = 0
  const m = CITY_STATE_RE.exec(head)
  if (m?.[1]) {
    return { location: `${m[1]}, ${m[2] ?? m[3] ?? ''}`.replace(/,\s*$/, ''), evidence: uniq(evidence).slice(0, 4) }
  }
  return { location: null, evidence: uniq(evidence).slice(0, 4) }
}

const REQUIRED_HEADINGS =
  /(requirements|qualifications|what you'?ll need|what we'?re looking for|you have|must have|basic qualifications|about you|who you are)/i
const PREFERRED_HEADINGS =
  /(preferred|nice to have|bonus|plus(?:es)?|good to have|additional|desirable|extra credit)/i

/** Splits a description into required vs preferred regions using its headings. */
export function splitRequirementSections(text: string): { required: string; preferred: string } {
  const lines = text.split(/\n/)
  let mode: 'none' | 'required' | 'preferred' = 'none'
  const required: string[] = []
  const preferred: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    const isHeading = trimmed.length > 0 && trimmed.length < 90 && !/[.!?]$/.test(trimmed)
    if (isHeading && PREFERRED_HEADINGS.test(trimmed)) {
      mode = 'preferred'
      continue
    }
    if (isHeading && REQUIRED_HEADINGS.test(trimmed)) {
      mode = 'required'
      continue
    }
    if (mode === 'required') required.push(line)
    else if (mode === 'preferred') preferred.push(line)
  }
  return { required: required.join('\n'), preferred: preferred.join('\n') }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Word-boundary match that tolerates `.`/`+`/`#` inside tokens (C++, .NET). */
export function matchesTerm(haystack: string, term: string): boolean {
  const t = normalize(term)
  if (!t) return false
  const pattern = new RegExp(`(^|[^a-z0-9+#.])${escapeRe(t)}([^a-z0-9+#]|$)`, 'i')
  return pattern.test(haystack)
}

export function findVocabulary(
  text: string,
  kinds: Array<VocabEntry['kind']>,
): string[] {
  if (!text.trim()) return []
  const hay = normalize(text)
  const found: string[] = []
  for (const entry of VOCABULARY) {
    if (!kinds.includes(entry.kind)) continue
    if (entry.aliases.some((alias) => matchesTerm(hay, alias))) found.push(entry.label)
  }
  return uniq(found)
}

const ROLE_TITLE_RE =
  /\b((?:Senior|Staff|Principal|Lead|Head of|Director of|Group|Associate|Junior)?\s?(?:Product|Software|Data|Design|Engineering|Growth|Marketing|Program|Project|Platform|Solutions|Security|Machine Learning|Frontend|Backend|Full[- ]?Stack)\s(?:Manager|Engineer|Designer|Scientist|Analyst|Architect|Lead|Director|Researcher|Marketer))\b/g

export function extractRoleHints(text: string): string[] {
  ROLE_TITLE_RE.lastIndex = 0
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = ROLE_TITLE_RE.exec(text)) !== null) {
    if (m[1]) out.push(m[1].replace(/\s+/g, ' ').trim())
    if (out.length > 40) break
  }
  return uniq(out).slice(0, 5)
}

export function parseJobDescription(text: string): ParsedJobDescription {
  const clean = text ?? ''
  const { required, preferred } = splitRequirementSections(clean)
  const { location, evidence } = extractLocation(clean)

  const allSkills = findVocabulary(clean, ['skill'])
  const requiredFound = required.trim() ? findVocabulary(required, ['skill']) : []
  const preferredFound = preferred.trim() ? findVocabulary(preferred, ['skill']) : []

  // Anything found only outside the labelled sections counts as required — most
  // postings state their core stack in the body.
  const preferredSet = new Set(preferredFound)
  const requiredSkills = uniq([
    ...requiredFound,
    ...allSkills.filter((s) => !preferredSet.has(s) && !requiredFound.includes(s)),
  ])

  return {
    salary: extractSalary(clean),
    years: extractYears(clean),
    location,
    arrangement: extractArrangement(clean),
    requiredSkills: requiredSkills.slice(0, 24),
    preferredSkills: preferredFound.filter((s) => !requiredFound.includes(s)).slice(0, 16),
    domains: findVocabulary(clean, ['domain']).slice(0, 10),
    tools: findVocabulary(clean, ['tool']).slice(0, 16),
    roleHints: extractRoleHints(clean),
    locationEvidence: evidence,
    wordCount: clean.trim() ? clean.trim().split(/\s+/).length : 0,
  }
}

/**
 * Best-effort company/role guess from a job posting URL, used to pre-fill the
 * capture form. Only patterns we can read with confidence are returned.
 */
export function guessFromUrl(url: string): { company?: string; role?: string } {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const parts = u.pathname.split('/').filter(Boolean)
    const out: { company?: string; role?: string } = {}

    const boards = ['boards.greenhouse.io', 'jobs.lever.co', 'job-boards.greenhouse.io', 'jobs.ashbyhq.com']
    if (boards.includes(host) && parts[0]) {
      out.company = titleize(parts[0])
    } else if (!/linkedin|indeed|glassdoor|ziprecruiter|monster|dice|wellfound|angel\.co/.test(host)) {
      const base = host.split('.')[0]
      if (base && base.length > 1) out.company = titleize(base)
    }

    const slug = parts[parts.length - 1] ?? ''
    if (slug && /[a-z]/.test(slug) && slug.includes('-') && !/^\d+$/.test(slug)) {
      const words = slug.replace(/\.\w+$/, '').split('-').filter((w) => !/^\d+$/.test(w) && w.length > 1)
      if (words.length >= 2 && words.length <= 8) out.role = titleize(words.join(' '))
    }
    return out
  } catch {
    return {}
  }
}

function titleize(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0]?.toUpperCase() + w.slice(1)))
    .join(' ')
}
