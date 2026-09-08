import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink } from 'lucide-react'
import { COLUMN_BY_ID, type ColumnDef } from '@/lib/filtering'
import {
  WORK_ARRANGEMENT_LABEL,
  type Opportunity,
  type OpportunityColumnId,
  type SortDirection,
} from '@/lib/types'
import type { FitResult } from '@/lib/fit'
import { cn, formatDate, formatSalaryRange, truncate } from '@/lib/utils'
import { Badge } from '@/components/ui/primitives'
import { Checkbox } from '@/components/ui/form'
import { CompanyMark, DueDate, FitCell, PriorityGlyph, StageBadge } from '@/components/common'
import type { Density } from '@/state/preferences'

/**
 * The opportunities table is built on CSS Grid rather than `<table>` so column
 * tracks can use `minmax()` — fixed columns keep their size while text columns
 * absorb the leftover width. The header and every row share one template
 * string, so they stay in lockstep. ARIA table roles carry the semantics.
 */

const SELECT_COLUMN = '2.25rem'

const ROW_ACTION_KEYS: Record<string, RowAction | undefined> = {
  s: 'stage',
  p: 'priority',
  e: 'archive',
  d: 'nextAction',
}

/** Rough pixel floor for a track, used to decide when the table must scroll. */
function trackMinPx(width: string): number {
  const minmax = /^minmax\(([\d.]+)rem/.exec(width)
  if (minmax?.[1]) return Number(minmax[1]) * 16
  const rem = /^([\d.]+)rem$/.exec(width)
  return rem?.[1] ? Number(rem[1]) * 16 : 96
}

interface TableProps {
  rows: Opportunity[]
  columns: OpportunityColumnId[]
  sortBy: OpportunityColumnId
  sortDir: SortDirection
  onSort: (column: OpportunityColumnId) => void
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  onOpen: (id: string) => void
  fit: Map<string, FitResult>
  density: Density
  /** Hides the selection column where bulk actions do not apply. */
  selectable?: boolean
  /** Single-key actions on the focused row; omitted where they do not apply. */
  onRowAction?: (row: Opportunity, action: RowAction) => void
}

export type RowAction = 'stage' | 'priority' | 'archive' | 'nextAction'

export function OpportunityTable({
  rows,
  columns,
  sortBy,
  sortDir,
  onSort,
  selected,
  onSelectedChange,
  onOpen,
  fit,
  density,
  selectable = true,
  onRowAction,
}: TableProps) {
  const [cursor, setCursor] = React.useState(0)
  const bodyRef = React.useRef<HTMLDivElement>(null)

  const visible = React.useMemo(
    () => columns.map((id) => COLUMN_BY_ID.get(id)).filter((c): c is ColumnDef => Boolean(c)),
    [columns],
  )

  const template = React.useMemo(
    () => (selectable ? `${SELECT_COLUMN} ` : '') + visible.map((c) => c.width).join(' '),
    [visible, selectable],
  )
  // Track floors + column gaps + the row's own horizontal padding.
  const minWidth = React.useMemo(
    () =>
      (selectable ? 36 : 0) +
      visible.reduce((total, c) => total + trackMinPx(c.width), 0) +
      visible.length * 12 +
      48,
    [visible, selectable],
  )

  React.useEffect(() => {
    if (cursor > rows.length - 1) setCursor(Math.max(0, rows.length - 1))
  }, [rows.length, cursor])

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, index))
    setCursor(clamped)
    const el = bodyRef.current?.querySelectorAll<HTMLElement>('[data-row]')[clamped]
    el?.focus()
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = rows.some((r) => selected.has(r.id)) && !allSelected

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusRow(cursor + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusRow(cursor - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusRow(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusRow(rows.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[cursor]
      if (row) onOpen(row.id)
    } else if (event.key === ' ' || event.key === 'x') {
      if (!selectable) return
      event.preventDefault()
      const row = rows[cursor]
      if (row) toggle(row.id)
    } else if (event.key === 'a' && (event.metaKey || event.ctrlKey)) {
      if (!selectable) return
      event.preventDefault()
      onSelectedChange(new Set(rows.map((r) => r.id)))
    } else if (event.key === 'Escape' && selected.size > 0) {
      event.preventDefault()
      onSelectedChange(new Set())
    } else if (onRowAction && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const action = ROW_ACTION_KEYS[event.key.toLowerCase()]
      const row = rows[cursor]
      if (action && row) {
        event.preventDefault()
        onRowAction(row, action)
      }
    }
  }

  // The stacked opportunity column needs two lines of room. Heights are fixed
  // rather than minimums so every row is identical, which keeps the scrollbar
  // steady and lets the browser skip offscreen rows.
  const stacked = columns.includes('opportunity')
  const rowPx = density === 'compact' ? (stacked ? 38 : 32) : stacked ? 52 : 44

  return (
    <div className="w-full overflow-x-auto">
      <div role="table" aria-rowcount={rows.length} style={{ minWidth }}>
        <div
          role="row"
          style={{ gridTemplateColumns: template }}
          className="sticky top-0 z-10 grid items-center gap-x-3 border-b border-line bg-bg/95 px-4 backdrop-blur-sm sm:px-6"
        >
          {selectable && (
            <span role="columnheader" className="flex h-8 items-center">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(checked) => onSelectedChange(checked ? new Set(rows.map((r) => r.id)) : new Set())}
                ariaLabel={allSelected ? 'Clear selection' : 'Select all rows'}
              />
            </span>
          )}
          {visible.map((column) => {
            const active = sortBy === column.id
            return (
              <span
                key={column.id}
                role="columnheader"
                aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="min-w-0"
              >
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.id)}
                    className={cn(
                      'group flex h-8 w-full items-center gap-1 text-2xs font-semibold uppercase tracking-[0.05em] transition-colors',
                      column.align === 'right' && 'justify-end',
                      active ? 'text-fg' : 'text-faint hover:text-muted',
                    )}
                  >
                    <span className="truncate">{column.label}</span>
                    {active ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
                      ) : (
                        <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
                      )
                    ) : (
                      <ChevronsUpDown
                        className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
                        aria-hidden
                      />
                    )}
                  </button>
                ) : (
                  <span
                    className={cn(
                      'flex h-8 items-center truncate text-2xs font-semibold uppercase tracking-[0.05em] text-faint',
                      column.align === 'right' && 'justify-end',
                    )}
                  >
                    {column.label}
                  </span>
                )}
              </span>
            )
          })}
        </div>

        <div ref={bodyRef} onKeyDown={onKeyDown} role="rowgroup">
          {rows.map((row, index) => {
            const isSelected = selected.has(row.id)
            return (
              <div
                key={row.id}
                data-row
                role="row"
                tabIndex={index === cursor ? 0 : -1}
                aria-selected={isSelected}
                aria-rowindex={index + 1}
                onFocus={() => setCursor(index)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('[data-stop-row-click]')) return
                  onOpen(row.id)
                }}
                style={{ gridTemplateColumns: template, height: rowPx, containIntrinsicSize: `auto ${rowPx}px` }}
                className={cn(
                  'virtual-row group grid cursor-pointer items-center gap-x-3 border-b border-line/70 px-4 transition-colors sm:px-6',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60',
                  isSelected ? 'bg-accent-soft/60' : 'hover:bg-subtle',
                  row.archivedAt && 'opacity-60',
                )}
              >
                {selectable && (
                  <span role="cell" data-stop-row-click className="flex items-center">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggle(row.id)}
                      ariaLabel={`Select ${row.role} at ${row.company}`}
                    />
                  </span>
                )}
                {visible.map((column) => (
                  <span
                    key={column.id}
                    role="cell"
                    className={cn(
                      'flex min-w-0 items-center',
                      column.align === 'right' && 'justify-end',
                    )}
                  >
                    <Cell column={column.id} row={row} fit={fit} />
                  </span>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Cell({
  column,
  row,
  fit,
}: {
  column: OpportunityColumnId
  row: Opportunity
  fit: Map<string, FitResult>
}) {
  switch (column) {
    case 'opportunity':
      return (
        <span className="flex min-w-0 items-center gap-2.5 py-1">
          <CompanyMark company={row.company} size="md" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-base font-medium leading-tight text-fg" title={row.company}>
                {row.company}
              </span>
              {row.jobUrl && (
                <a
                  href={row.jobUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-stop-row-click
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Open the posting for ${row.role} at ${row.company}`}
                  className="shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </span>
            <span className="mt-0.5 block truncate text-sm leading-tight text-muted" title={row.role}>
              {row.role}
            </span>
          </span>
        </span>
      )
    case 'company':
      return (
        <span className="flex min-w-0 items-center gap-2">
          <CompanyMark company={row.company} size="sm" />
          <span className="truncate text-base font-medium text-fg" title={row.company}>
            {row.company}
          </span>
        </span>
      )
    case 'role':
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-base text-fg" title={row.role}>
            {row.role}
          </span>
          {row.jobUrl && (
            <a
              href={row.jobUrl}
              target="_blank"
              rel="noreferrer noopener"
              data-stop-row-click
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open the posting for ${row.role} at ${row.company}`}
              className="shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </span>
      )
    case 'stage':
      return <StageBadge stage={row.stage} />
    case 'priority':
      return (
        <span className="flex items-center gap-1.5">
          <PriorityGlyph priority={row.priority} />
          <span className="text-sm text-muted">{row.priority[0]?.toUpperCase()}</span>
        </span>
      )
    case 'fit':
      return <FitCell fit={fit.get(row.id)} />
    case 'location':
      return (
        <span className="truncate text-sm text-muted" title={row.location ?? ''}>
          {row.location || '—'}
        </span>
      )
    case 'arrangement':
      return (
        <span className="truncate text-sm text-muted">
          {row.workArrangement === 'unknown' ? '—' : WORK_ARRANGEMENT_LABEL[row.workArrangement]}
        </span>
      )
    case 'compensation':
      return (
        <span className="truncate text-sm tabular-nums text-muted">
          {formatSalaryRange(row.salaryMin, row.salaryMax, row.currency)}
        </span>
      )
    case 'source':
      return (
        <span className="truncate text-sm text-muted" title={row.source ?? ''}>
          {row.source || '—'}
        </span>
      )
    case 'tags':
      return row.tags.length === 0 ? (
        <span className="text-sm text-faint">—</span>
      ) : (
        <span className="flex min-w-0 items-center gap-1">
          {row.tags.slice(0, 2).map((tag) => (
            <Badge key={tag}>{truncate(tag, 14)}</Badge>
          ))}
          {row.tags.length > 2 && (
            <span className="shrink-0 text-2xs text-faint" title={row.tags.join(', ')}>
              +{row.tags.length - 2}
            </span>
          )}
        </span>
      )
    case 'nextAction':
      return row.nextAction ? (
        <span className="truncate text-sm text-fg" title={row.nextAction}>
          {row.nextAction}
        </span>
      ) : (
        <span className="text-sm text-faint">—</span>
      )
    case 'nextActionDate':
      return <DueDate date={row.nextActionDate} />
    case 'dateDiscovered':
      return <span className="truncate text-sm tabular-nums text-muted">{formatDate(row.dateDiscovered)}</span>
    case 'dateApplied':
      return <span className="truncate text-sm tabular-nums text-muted">{formatDate(row.dateApplied)}</span>
    case 'updatedAt':
      return <span className="truncate text-sm tabular-nums text-muted">{formatDate(row.updatedAt)}</span>
    default:
      return null
  }
}

/* ------------------------------ Mobile cards ------------------------------ */

export function OpportunityCards({
  rows,
  onOpen,
  fit,
  selected,
  onSelectedChange,
}: {
  rows: Opportunity[]
  onOpen: (id: string) => void
  fit: Map<string, FitResult>
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
}) {
  return (
    <ul className="divide-y divide-line border-t border-line">
      {rows.map((row) => {
        const isSelected = selected.has(row.id)
        return (
          <li key={row.id} className={cn('relative flex items-start gap-3 px-4 py-3', isSelected && 'bg-accent-soft/50')}>
            <button
              type="button"
              aria-label={isSelected ? `Deselect ${row.role}` : `Select ${row.role}`}
              aria-pressed={isSelected}
              onClick={() => {
                const next = new Set(selected)
                if (next.has(row.id)) next.delete(row.id)
                else next.add(row.id)
                onSelectedChange(next)
              }}
              className="mt-0.5 shrink-0 rounded"
            >
              <CompanyMark company={row.company} size="md" />
            </button>
            <button type="button" onClick={() => onOpen(row.id)} className="min-w-0 flex-1 text-left">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-base font-medium text-fg">{row.role}</span>
                <FitCell fit={fit.get(row.id)} />
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                <span className="truncate">{row.company}</span>
                {row.location && <span className="truncate text-faint">· {row.location}</span>}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StageBadge stage={row.stage} />
                <PriorityGlyph priority={row.priority} />
                {row.nextActionDate && <DueDate date={row.nextActionDate} className="ml-auto" />}
              </span>
              {row.nextAction && <span className="mt-1 block truncate text-sm text-fg">{row.nextAction}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
