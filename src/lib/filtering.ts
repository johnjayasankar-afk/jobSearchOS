/**
 * Filtering, sorting and search for the opportunities table. Kept free of React
 * so the behaviour can be tested directly and reused by the command palette.
 */
import type { FitResult } from './fit'
import {
  EMPTY_FILTERS,
  PRIORITY_META,
  STAGE_META,
  type Opportunity,
  type OpportunityColumnId,
  type OpportunityFilters,
  type SortDirection,
} from './types'
import { daysFromToday, normalize, parseAnyDate } from './utils'

export function searchableText(o: Opportunity): string {
  return normalize(
    [
      o.company,
      o.role,
      o.location ?? '',
      o.source ?? '',
      o.tags.join(' '),
      o.notes ?? '',
      o.whyInterested ?? '',
      o.nextAction ?? '',
      STAGE_META[o.stage].label,
    ].join(' | '),
  )
}

/** Every term must appear somewhere in the record (AND semantics). */
export function matchesQuery(o: Opportunity, query: string): boolean {
  const terms = normalize(query)
    .split(/\s+/)
    .filter((t) => t.length > 0)
  if (terms.length === 0) return true
  const haystack = searchableText(o)
  return terms.every((term) => haystack.includes(term))
}

export function applyFilters(
  opportunities: Opportunity[],
  filters: OpportunityFilters,
  fit: Map<string, FitResult>,
): Opportunity[] {
  const {
    query,
    stages,
    priorities,
    arrangements,
    tags,
    sources,
    locationQuery,
    fitMin,
    fitMax,
    dateField,
    dateWithinDays,
    archived,
    hasNextAction,
  } = filters

  const location = normalize(locationQuery)
  const usesFitRange = fitMin > 0 || fitMax < 100

  return opportunities.filter((o) => {
    if (archived === 'active' && o.archivedAt) return false
    if (archived === 'archived' && !o.archivedAt) return false
    if (stages.length > 0 && !stages.includes(o.stage)) return false
    if (priorities.length > 0 && !priorities.includes(o.priority)) return false
    if (arrangements.length > 0 && !arrangements.includes(o.workArrangement)) return false
    if (sources.length > 0 && !sources.includes(o.source ?? '')) return false
    if (tags.length > 0 && !tags.every((t) => o.tags.includes(t))) return false
    if (location && !normalize(o.location ?? '').includes(location)) return false

    if (usesFitRange) {
      const score = fit.get(o.id)?.score
      // An unscored record cannot satisfy a narrowed fit range.
      if (score === null || score === undefined) return false
      if (score < fitMin || score > fitMax) return false
    }

    if (dateWithinDays !== null) {
      const value =
        dateField === 'updatedAt' ? o.updatedAt : dateField === 'dateApplied' ? o.dateApplied : o.dateDiscovered
      const d = parseAnyDate(value)
      if (!d) return false
      const ageDays = (Date.now() - d.getTime()) / 86_400_000
      if (ageDays > dateWithinDays || ageDays < -1) return false
    }

    if (hasNextAction === 'yes' && !o.nextAction) return false
    if (hasNextAction === 'no' && o.nextAction) return false
    if (hasNextAction === 'overdue') {
      if (!o.nextAction) return false
      const days = daysFromToday(o.nextActionDate)
      if (days === null || days > 0) return false
    }

    if (!matchesQuery(o, query)) return false
    return true
  })
}

export function countActiveFilters(filters: OpportunityFilters): number {
  let n = 0
  if (filters.stages.length > 0) n++
  if (filters.priorities.length > 0) n++
  if (filters.arrangements.length > 0) n++
  if (filters.tags.length > 0) n++
  if (filters.sources.length > 0) n++
  if (filters.locationQuery.trim()) n++
  if (filters.fitMin > 0 || filters.fitMax < 100) n++
  if (filters.dateWithinDays !== null) n++
  if (filters.archived !== EMPTY_FILTERS.archived) n++
  if (filters.hasNextAction !== 'any') n++
  return n
}

type SortValue = string | number

function sortValue(o: Opportunity, column: OpportunityColumnId, fit: Map<string, FitResult>): SortValue {
  switch (column) {
    case 'opportunity':
    case 'company':
      return normalize(`${o.company} ${o.role}`)
    case 'role':
      return normalize(o.role)
    case 'stage':
      return STAGE_META[o.stage].order
    case 'priority':
      return PRIORITY_META[o.priority].weight
    case 'fit':
      return fit.get(o.id)?.score ?? -1
    case 'location':
      return normalize(o.location ?? '')
    case 'arrangement':
      return o.workArrangement
    case 'compensation':
      return o.salaryMax ?? o.salaryMin ?? -1
    case 'source':
      return normalize(o.source ?? '')
    case 'tags':
      return normalize(o.tags.join(', '))
    case 'nextAction':
      return normalize(o.nextAction ?? '')
    case 'nextActionDate':
      // Records without a date sort last in both directions.
      return o.nextActionDate ? new Date(o.nextActionDate).getTime() : Number.NEGATIVE_INFINITY
    case 'dateDiscovered':
      return new Date(o.dateDiscovered).getTime()
    case 'dateApplied':
      return o.dateApplied ? new Date(o.dateApplied).getTime() : Number.NEGATIVE_INFINITY
    case 'updatedAt':
      return new Date(o.updatedAt).getTime()
    default:
      return 0
  }
}

export function sortOpportunities(
  opportunities: Opportunity[],
  column: OpportunityColumnId,
  direction: SortDirection,
  fit: Map<string, FitResult>,
): Opportunity[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...opportunities].sort((a, b) => {
    const va = sortValue(a, column, fit)
    const vb = sortValue(b, column, fit)
    if (va < vb) return -1 * factor
    if (va > vb) return 1 * factor
    // Stable secondary sort keeps the order predictable between renders.
    return a.company.localeCompare(b.company) || a.role.localeCompare(b.role)
  })
}

export interface ColumnDef {
  id: OpportunityColumnId
  label: string
  /** Grid track sizing for the table layout. */
  width: string
  align?: 'left' | 'right'
  sortable: boolean
}

export const COLUMNS: ColumnDef[] = [
  // Track sizes are tuned so the default column set fits a 1280px laptop with
  // the sidebar expanded, and every header label survives without clipping.
  { id: 'opportunity', label: 'Opportunity', width: 'minmax(13rem, 2.6fr)', sortable: true },
  { id: 'company', label: 'Company', width: 'minmax(7rem, 1fr)', sortable: true },
  { id: 'role', label: 'Role', width: 'minmax(9rem, 2.1fr)', sortable: true },
  { id: 'stage', label: 'Stage', width: '8.25rem', sortable: true },
  { id: 'priority', label: 'Priority', width: '5.25rem', sortable: true },
  { id: 'fit', label: 'Fit', width: '4.5rem', sortable: true },
  { id: 'location', label: 'Location', width: 'minmax(5.75rem, 0.85fr)', sortable: true },
  { id: 'arrangement', label: 'Arrangement', width: '7rem', sortable: true },
  { id: 'compensation', label: 'Compensation', width: '7.25rem', align: 'right', sortable: true },
  { id: 'source', label: 'Source', width: '6.5rem', sortable: true },
  { id: 'tags', label: 'Tags', width: 'minmax(6.5rem, 0.9fr)', sortable: false },
  { id: 'nextAction', label: 'Next action', width: 'minmax(7rem, 1.3fr)', sortable: true },
  { id: 'nextActionDate', label: 'Due', width: '5.5rem', sortable: true },
  { id: 'dateDiscovered', label: 'Discovered', width: '6.25rem', sortable: true },
  { id: 'dateApplied', label: 'Applied', width: '5.5rem', sortable: true },
  { id: 'updatedAt', label: 'Updated', width: '5.5rem', sortable: true },
]

export const COLUMN_BY_ID = new Map(COLUMNS.map((c) => [c.id, c]))
