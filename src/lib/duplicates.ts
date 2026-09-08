/**
 * Duplicate detection for the capture flow.
 *
 * Adding the same posting twice is the easiest way to corrupt a pipeline: the
 * funnel double-counts and two half-updated records drift apart. This compares
 * a draft against what is already tracked and reports what it finds, without
 * ever blocking the save — occasionally a company really is hiring two people
 * for the same title.
 */
import type { Opportunity } from './types'
import { normalize } from './utils'

export interface DuplicateReport {
  /** Records that look like the same posting. */
  likely: Opportunity[]
  /** Other roles at the same company, which are worth knowing about. */
  sameCompany: Opportunity[]
}

const ROLE_NOISE = new Set([
  'senior',
  'sr',
  'staff',
  'principal',
  'lead',
  'junior',
  'jr',
  'associate',
  'i',
  'ii',
  'iii',
  'iv',
  'the',
  'of',
  'and',
  'for',
])

function roleTokens(role: string): Set<string> {
  return new Set(
    normalize(role)
      .split(/[^a-z0-9+#]+/)
      .filter((t) => t.length > 1 && !ROLE_NOISE.has(t)),
  )
}

/** Jaccard overlap of the meaningful words in two role titles. */
export function roleSimilarity(a: string, b: string): number {
  const ta = roleTokens(a)
  const tb = roleTokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const token of ta) if (tb.has(token)) shared += 1
  return shared / (ta.size + tb.size - shared)
}

function companyMatches(a: string, b: string): boolean {
  const na = normalize(a).replace(/[^a-z0-9]/g, '')
  const nb = normalize(b).replace(/[^a-z0-9]/g, '')
  if (!na || !nb) return false
  return na === nb || na.startsWith(nb) || nb.startsWith(na)
}

export function findDuplicates(
  opportunities: Opportunity[],
  draft: { company: string; role: string; jobUrl?: string },
  excludeId?: string,
): DuplicateReport {
  const company = draft.company.trim()
  const role = draft.role.trim()
  if (company.length < 2) return { likely: [], sameCompany: [] }

  const url = draft.jobUrl?.trim().toLowerCase()
  const likely: Opportunity[] = []
  const sameCompany: Opportunity[] = []

  for (const o of opportunities) {
    if (o.id === excludeId) continue

    // An identical posting URL is conclusive on its own.
    if (url && o.jobUrl && o.jobUrl.trim().toLowerCase() === url) {
      likely.push(o)
      continue
    }
    if (!companyMatches(o.company, company)) continue
    if (role.length >= 3 && roleSimilarity(o.role, role) >= 0.6) likely.push(o)
    else sameCompany.push(o)
  }

  return { likely, sameCompany }
}
