import * as React from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Modal, Tooltip } from '@/components/ui/overlay'
import { Button } from '@/components/ui/primitives'
import { CompanyMark, PriorityGlyph, StageBadge } from '@/components/common'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import type { FitResult } from '@/lib/fit'
import { STAGE_META, WORK_ARRANGEMENT_LABEL, type Opportunity } from '@/lib/types'
import { comparabilityNote, computeOfferValue } from '@/lib/offers'
import { cn, daysSince, formatDate, formatMoney, formatSalaryRange, pluralize } from '@/lib/utils'

/**
 * Puts a handful of opportunities beside each other so a choice can be made on
 * evidence rather than memory. Every figure comes from a record — the only
 * judgement the app makes is which cell in a row is the strongest, and it says
 * so with a quiet marker rather than a recommendation.
 */
export function CompareDialog() {
  const ui = useAppUi()
  const workspace = useWorkspace()

  const records = ui.compare.ids
    .map((id) => workspace.byId.get(id))
    .filter((o): o is Opportunity => Boolean(o))

  const rows = React.useMemo(() => buildRows(records, workspace), [records, workspace])

  return (
    <Modal
      open={ui.compare.open}
      onOpenChange={(open) => !open && ui.closeCompare()}
      title={`Compare ${records.length} ${pluralize(records.length, 'opportunity', 'opportunities')}`}
      description="Everything here comes from what you have recorded. Blank means not recorded, not zero."
      size="xl"
      bodyClassName="p-0"
      footer={
        <Button variant="secondary" onClick={() => ui.closeCompare()}>
          Close
        </Button>
      }
    >
      {records.length < 2 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">
          Select at least two opportunities to compare.
        </p>
      ) : (
        <div className="overflow-x-auto">
          {/* An explicit minimum keeps the columns bounded so long values
              truncate; past that the dialog scrolls sideways. */}
          <div style={{ minWidth: `${10 + records.length * 13}rem` }}>
            {/* Header */}
            <div
              className="sticky top-0 z-10 grid border-b border-line bg-panel"
              style={{ gridTemplateColumns: `10rem repeat(${records.length}, minmax(0, 1fr))` }}
            >
              <div className="border-r border-line px-4 py-3" />
              {records.map((o) => (
                <div key={o.id} className="min-w-0 border-r border-line px-4 py-3 last:border-r-0">
                  <div className="flex items-center gap-2">
                    <CompanyMark company={o.company} size="sm" />
                    <span className="truncate text-base font-medium text-fg" title={o.company}>
                      {o.company}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted" title={o.role}>
                    {o.role}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      ui.closeCompare()
                      ui.openOpportunity(o.id)
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent transition-opacity hover:opacity-80"
                  >
                    Open
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>

            {/* Rows */}
            {rows.map((row) => (
              <div
                key={row.label}
                className={cn(
                  'grid border-b border-line/70 last:border-b-0',
                  row.group && 'bg-subtle/40',
                )}
                style={{ gridTemplateColumns: `10rem repeat(${records.length}, minmax(0, 1fr))` }}
              >
                <div className="border-r border-line px-4 py-2">
                  <span
                    className={cn(
                      'text-xs',
                      row.group ? 'font-semibold uppercase tracking-wide text-faint' : 'text-muted',
                    )}
                  >
                    {row.label}
                  </span>
                </div>
                {row.cells.map((cell, i) => (
                  <div
                    key={i}
                    className="min-w-0 border-r border-line px-4 py-2 last:border-r-0"
                  >
                    {cell.best ? (
                      <Tooltip content={row.bestHint ?? 'Strongest in this row'}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 truncate text-base font-medium tabular-nums text-fg">
                            {cell.node}
                          </span>
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive"
                            aria-label="strongest in this row"
                          />
                        </span>
                      </Tooltip>
                    ) : (
                      <span className="flex min-w-0 items-center truncate text-base tabular-nums text-fg">
                        {cell.node}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

interface Cell {
  node: React.ReactNode
  best?: boolean
}

interface Row {
  label: string
  cells: Cell[]
  group?: boolean
  bestHint?: string
}

type WorkspaceLike = ReturnType<typeof useWorkspace>

function buildRows(records: Opportunity[], workspace: WorkspaceLike): Row[] {
  if (records.length === 0) return []
  const fits = records.map((o) => workspace.fit.get(o.id))

  const rows: Row[] = []

  const numericRow = (
    label: string,
    values: Array<number | null>,
    render: (value: number | null, index: number) => React.ReactNode,
    hint?: string,
  ): Row => {
    const present = values.filter((v): v is number => v !== null)
    const max = present.length > 1 ? Math.max(...present) : null
    const distinct = new Set(present).size > 1
    return {
      label,
      bestHint: hint,
      cells: values.map((v, i) => ({
        node: render(v, i),
        best: distinct && max !== null && v === max,
      })),
    }
  }

  rows.push({ label: 'Where it stands', group: true, cells: records.map(() => ({ node: '' })) })
  rows.push({
    label: 'Stage',
    cells: records.map((o) => ({ node: <StageBadge stage={o.stage} /> })),
  })
  rows.push({
    label: 'Priority',
    cells: records.map((o) => ({
      node: (
        <span className="inline-flex items-center gap-1.5">
          <PriorityGlyph priority={o.priority} />
          <span className="text-sm capitalize text-muted">{o.priority}</span>
        </span>
      ),
    })),
  })
  rows.push({
    label: 'Next action',
    cells: records.map((o) => ({
      node: o.nextAction ? (
        <span className="block truncate text-sm" title={o.nextAction}>
          {o.nextAction}
          {o.nextActionDate && <span className="text-faint"> · {formatDate(o.nextActionDate)}</span>}
        </span>
      ) : (
        <span className="text-sm text-faint">None set</span>
      ),
    })),
  })
  rows.push(
    numericRow(
      'Days since applied',
      records.map((o) => daysSince(o.dateApplied)),
      (v) => (v === null ? <span className="text-sm text-faint">Not applied</span> : `${v}d`),
    ),
  )

  rows.push({ label: 'The offer on paper', group: true, cells: records.map(() => ({ node: '' })) })
  rows.push(
    numericRow(
      'Compensation',
      records.map((o) => o.salaryMax ?? o.salaryMin ?? null),
      (_v, i) => {
        const o = records[i]
        if (!o) return '—'
        const text = formatSalaryRange(o.salaryMin, o.salaryMax, o.currency)
        return text === '—' ? <span className="text-sm text-faint">Not stated</span> : text
      },
      'Highest top-of-range',
    ),
  )
  rows.push({
    label: 'Location',
    cells: records.map((o) => ({
      node: (
        <span className="block truncate text-sm">
          {o.location || WORK_ARRANGEMENT_LABEL[o.workArrangement]}
          {o.location && o.workArrangement !== 'unknown' && (
            <span className="text-faint"> · {WORK_ARRANGEMENT_LABEL[o.workArrangement]}</span>
          )}
        </span>
      ),
    })),
  })
  rows.push({
    label: 'Source',
    cells: records.map((o) => ({
      node: o.source ? <span className="text-sm">{o.source}</span> : <span className="text-sm text-faint">—</span>,
    })),
  })

  rows.push({ label: 'Fit against your profile', group: true, cells: records.map(() => ({ node: '' })) })
  rows.push(
    numericRow(
      'Overall fit',
      fits.map((f) => f?.score ?? null),
      (v, i) => {
        const f = fits[i]
        if (v === null || !f) return <span className="text-sm text-faint">Not scored</span>
        return (
          <span className="inline-flex items-baseline gap-2">
            <span className="font-semibold">{v}</span>
            <span className="truncate text-xs text-muted">{f.band}</span>
          </span>
        )
      },
      'Highest fit score',
    ),
  )

  const componentIds: Array<{ id: FitResult['components'][number]['id']; label: string }> = [
    { id: 'role', label: 'Role alignment' },
    { id: 'skills', label: 'Skills' },
    { id: 'domain', label: 'Domain' },
    { id: 'seniority', label: 'Seniority' },
    { id: 'location', label: 'Location fit' },
    { id: 'compensation', label: 'Pay vs your bar' },
  ]
  for (const component of componentIds) {
    const values = fits.map((f) => {
      const c = f?.components.find((x) => x.id === component.id)
      if (!c || c.earned === null) return null
      return Math.round((c.earned / c.weight) * 100)
    })
    rows.push(
      numericRow(
        component.label,
        values,
        (v) =>
          v === null ? (
            <span className="text-sm text-faint">n/a</span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="text-sm">{v}%</span>
              <span className="h-1 w-12 overflow-hidden rounded-full bg-raised" aria-hidden>
                <span
                  className={cn(
                    'block h-full rounded-full',
                    v >= 80 ? 'bg-positive' : v >= 50 ? 'bg-accent' : v >= 25 ? 'bg-caution' : 'bg-critical',
                  )}
                  style={{ width: `${Math.max(v, 3)}%` }}
                />
              </span>
            </span>
          ),
      ),
    )
  }

  // Only worth showing once at least one of the compared records has an offer.
  const offerValues = records.map((o) => computeOfferValue(o.offer, o.currency))
  if (records.some((o) => o.offer)) {
    rows.push({ label: 'On the table', group: true, cells: records.map(() => ({ node: '' })) })
    const money = (index: number, amount: number) =>
      formatMoney(Math.round(amount), offerValues[index]?.currency ?? records[index]?.currency ?? 'USD')

    rows.push(
      numericRow(
        'First year',
        records.map((o, i) => (o.offer && offerValues[i]?.usable ? (offerValues[i]?.firstYear ?? null) : null)),
        (v, i) => (v === null ? <span className="text-sm text-faint">No offer</span> : money(i, v)),
        'Highest first-year total',
      ),
    )
    rows.push(
      numericRow(
        'Each year after',
        records.map((o, i) => (o.offer && offerValues[i]?.usable ? (offerValues[i]?.steadyYear ?? null) : null)),
        (v, i) => (v === null ? <span className="text-sm text-faint">—</span> : money(i, v)),
        'Highest steady-state total',
      ),
    )
    rows.push(
      numericRow(
        'Whole package',
        records.map((o, i) => (o.offer && offerValues[i]?.usable ? (offerValues[i]?.total ?? null) : null)),
        (v, i) =>
          v === null ? (
            <span className="text-sm text-faint">—</span>
          ) : (
            <span className="inline-flex items-baseline gap-1.5">
              {money(i, v)}
              <span className="text-xs text-faint">over {offerValues[i]?.years ?? 4}y</span>
            </span>
          ),
        'Highest total across the vesting period',
      ),
    )
    rows.push({
      label: 'Decide by',
      cells: records.map((o) => ({
        node: o.offer?.decisionDeadline ? (
          <span className="text-sm tabular-nums">{formatDate(o.offer.decisionDeadline)}</span>
        ) : (
          <span className="text-sm text-faint">—</span>
        ),
      })),
    })
    const note = comparabilityNote(offerValues.filter((v, i) => records[i]?.offer && v.usable))
    if (note) {
      rows.push({
        label: 'Note',
        cells: records.map((_, i) => ({
          node: i === 0 ? <span className="text-xs leading-relaxed text-muted">{note}</span> : '',
        })),
      })
    }
  }

  rows.push({ label: 'Momentum', group: true, cells: records.map(() => ({ node: '' })) })
  rows.push(
    numericRow(
      'Interviews held',
      records.map((o) => (workspace.interviewsByOpportunity.get(o.id) ?? []).length),
      (v) => String(v ?? 0),
    ),
  )
  rows.push(
    numericRow(
      'People known',
      records.map((o) => (workspace.contactsByOpportunity.get(o.id) ?? []).length),
      (v) => String(v ?? 0),
    ),
  )
  rows.push({
    label: 'Furthest stage',
    cells: records.map((o) => {
      const history = o.stageHistory ?? []
      const furthest = history.reduce(
        (best, visit) => (STAGE_META[visit.stage].order > STAGE_META[best].order ? visit.stage : best),
        o.stage,
      )
      return { node: <span className="text-sm">{STAGE_META[furthest].label}</span> }
    }),
  })

  return rows
}
