import * as React from 'react'
import { ChevronDown, ListFilter, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  EMPTY_FILTERS,
  PRIORITIES,
  PRIORITY_META,
  STAGES,
  STAGE_META,
  WORK_ARRANGEMENTS,
  WORK_ARRANGEMENT_LABEL,
  type OpportunityFilters,
  type Priority,
  type Stage,
  type WorkArrangement,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button, Dot } from '@/components/ui/primitives'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlay'
import { Checkbox, Field, Input, RangeSlider, Select } from '@/components/ui/form'
import { PriorityGlyph } from '@/components/common'

/* ----------------------------- Multi-select ------------------------------- */

interface Option<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
  group?: string
}

export function MultiFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  searchable,
  emptyLabel = 'No options yet',
}: {
  label: string
  options: Array<Option<T>>
  value: T[]
  onChange: (value: T[]) => void
  searchable?: boolean
  emptyLabel?: string
}) {
  const [query, setQuery] = React.useState('')
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options
  const groups = Array.from(new Set(filtered.map((o) => o.group ?? '')))

  const toggle = (v: T) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }

  const summary =
    value.length === 0
      ? label
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? label)
        : `${label} · ${value.length}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 max-w-[12rem] shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium shadow-xs transition-colors',
            value.length > 0
              ? 'border-accent/40 bg-accent-soft text-accent'
              : 'border-line bg-panel text-muted hover:border-line-strong hover:text-fg',
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1.5">
        {searchable && (
          <div className="p-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              aria-label={`Search ${label}`}
              className="h-7 text-sm"
              autoFocus
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-1.5 py-3 text-center text-sm text-faint">{emptyLabel}</p>
          ) : (
            groups.map((group) => (
              <div key={group}>
                {group && (
                  <p className="px-1.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-faint">
                    {group}
                  </p>
                )}
                {filtered
                  .filter((o) => (o.group ?? '') === group)
                  .map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggle(option.value)}
                      aria-pressed={value.includes(option.value)}
                      className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left text-base transition-colors hover:bg-subtle"
                    >
                      <Checkbox
                        checked={value.includes(option.value)}
                        onChange={() => toggle(option.value)}
                        ariaLabel={option.label}
                      />
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <span className="min-w-0 flex-1 truncate text-fg">{option.label}</span>
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
        {value.length > 0 && (
          <div className="border-t border-line p-1 pt-1.5">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full rounded px-1.5 py-1 text-left text-sm text-muted transition-colors hover:bg-subtle hover:text-fg"
            >
              Clear {label.toLowerCase()}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/* -------------------------------- Filter bar ------------------------------ */

export function FilterBar({
  filters,
  onChange,
  tags,
  sources,
  resultCount,
  totalCount,
}: {
  filters: OpportunityFilters
  onChange: (next: OpportunityFilters) => void
  tags: string[]
  sources: string[]
  resultCount: number
  totalCount: number
}) {
  const searchRef = React.useRef<HTMLInputElement>(null)
  const patch = (changes: Partial<OpportunityFilters>) => onChange({ ...filters, ...changes })

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement | null
        if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const extraCount =
    (filters.arrangements.length > 0 ? 1 : 0) +
    (filters.tags.length > 0 ? 1 : 0) +
    (filters.sources.length > 0 ? 1 : 0) +
    (filters.locationQuery.trim() ? 1 : 0) +
    (filters.fitMin > 0 || filters.fitMax < 100 ? 1 : 0) +
    (filters.dateWithinDays !== null ? 1 : 0) +
    (filters.hasNextAction !== 'any' ? 1 : 0) +
    (filters.archived !== 'active' ? 1 : 0)

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
      <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
        <input
          ref={searchRef}
          type="search"
          value={filters.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder="Search company, role, notes…"
          aria-label="Search opportunities"
          className="h-8 w-full rounded-md border border-line bg-panel pl-8 pr-8 text-base text-fg shadow-xs transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.query ? (
          <button
            type="button"
            onClick={() => patch({ query: '' })}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-faint transition-colors hover:bg-subtle hover:text-fg"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <kbd className="kbd pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">/</kbd>
        )}
      </div>

      <MultiFilter<Stage>
        label="Stage"
        value={filters.stages}
        onChange={(stages) => patch({ stages })}
        options={STAGES.map((s) => ({
          value: s,
          label: STAGE_META[s].label,
          icon: <Dot tone={STAGE_META[s].tone} />,
          group: STAGE_META[s].group === 'exploring' ? 'Exploring' : STAGE_META[s].group === 'applying' ? 'Applying' : STAGE_META[s].group === 'interviewing' ? 'Interviewing' : 'Closed',
        }))}
      />

      <MultiFilter<Priority>
        label="Priority"
        value={filters.priorities}
        onChange={(priorities) => patch({ priorities })}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: PRIORITY_META[p].label,
          icon: <PriorityGlyph priority={p} />,
        }))}
      />

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium shadow-xs transition-colors',
              extraCount > 0
                ? 'border-accent/40 bg-accent-soft text-accent'
                : 'border-line bg-panel text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">More filters</span>
            {extraCount > 0 && <span className="tabular-nums">{extraCount}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] space-y-3">
          <Field label="Location contains">
            <Input
              value={filters.locationQuery}
              onChange={(e) => patch({ locationQuery: e.target.value })}
              placeholder="New York, remote…"
              className="h-8"
            />
          </Field>

          <Field label="Work arrangement">
            <div className="flex flex-wrap gap-1.5">
              {WORK_ARRANGEMENTS.map((a) => {
                const on = filters.arrangements.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patch({
                        arrangements: on
                          ? filters.arrangements.filter((x) => x !== a)
                          : [...filters.arrangements, a as WorkArrangement],
                      })
                    }
                    className={cn(
                      'rounded-md border px-2 py-1 text-sm transition-colors',
                      on ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line bg-panel text-muted hover:text-fg',
                    )}
                  >
                    {WORK_ARRANGEMENT_LABEL[a]}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field
            label={`Fit score ${filters.fitMin}–${filters.fitMax}`}
            hint={filters.fitMin > 0 || filters.fitMax < 100 ? 'Unscored opportunities are excluded while this range is narrowed.' : undefined}
          >
            <RangeSlider
              ariaLabel="Fit score range"
              value={[filters.fitMin, filters.fitMax]}
              onChange={([fitMin, fitMax]) => patch({ fitMin, fitMax })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Date field">
              <Select
                ariaLabel="Date field"
                size="sm"
                value={filters.dateField}
                onChange={(dateField) => patch({ dateField })}
                options={[
                  { value: 'dateDiscovered', label: 'Discovered' },
                  { value: 'dateApplied', label: 'Applied' },
                  { value: 'updatedAt', label: 'Updated' },
                ]}
              />
            </Field>
            <Field label="Within">
              <Select
                ariaLabel="Date window"
                size="sm"
                value={filters.dateWithinDays === null ? 'any' : String(filters.dateWithinDays)}
                onChange={(v) => patch({ dateWithinDays: v === 'any' ? null : Number(v) })}
                options={[
                  { value: 'any', label: 'Any time' },
                  { value: '7', label: 'Last 7 days' },
                  { value: '14', label: 'Last 14 days' },
                  { value: '30', label: 'Last 30 days' },
                  { value: '90', label: 'Last 90 days' },
                ]}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Next action">
              <Select
                ariaLabel="Next action filter"
                size="sm"
                value={filters.hasNextAction}
                onChange={(hasNextAction) => patch({ hasNextAction })}
                options={[
                  { value: 'any', label: 'Any' },
                  { value: 'yes', label: 'Has one' },
                  { value: 'no', label: 'Missing' },
                  { value: 'overdue', label: 'Overdue' },
                ]}
              />
            </Field>
            <Field label="Archive">
              <Select
                ariaLabel="Archive filter"
                size="sm"
                value={filters.archived}
                onChange={(archived) => patch({ archived })}
                options={[
                  { value: 'active', label: 'Active only' },
                  { value: 'archived', label: 'Archived only' },
                  { value: 'all', label: 'Everything' },
                ]}
              />
            </Field>
          </div>

          {tags.length > 0 && (
            <Field label="Tags">
              <MultiFilter
                label="Tags"
                searchable
                value={filters.tags}
                onChange={(t) => patch({ tags: t })}
                options={tags.map((t) => ({ value: t, label: t }))}
              />
            </Field>
          )}

          {sources.length > 0 && (
            <Field label="Source">
              <MultiFilter
                label="Source"
                searchable
                value={filters.sources}
                onChange={(s) => patch({ sources: s })}
                options={sources.map((s) => ({ value: s, label: s }))}
              />
            </Field>
          )}
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-2">
        <p className="whitespace-nowrap text-xs tabular-nums text-faint">
          {resultCount === totalCount
            ? `${totalCount} ${totalCount === 1 ? 'opportunity' : 'opportunities'}`
            : `${resultCount} of ${totalCount}`}
        </p>
      </div>
    </div>
  )
}

/* --------------------------- Active filter chips -------------------------- */

export function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: OpportunityFilters
  onChange: (next: OpportunityFilters) => void
}) {
  const chips: Array<{ key: string; label: string; clear: () => void }> = []
  const patch = (changes: Partial<OpportunityFilters>) => onChange({ ...filters, ...changes })

  for (const stage of filters.stages) {
    chips.push({
      key: `stage-${stage}`,
      label: STAGE_META[stage].label,
      clear: () => patch({ stages: filters.stages.filter((s) => s !== stage) }),
    })
  }
  for (const priority of filters.priorities) {
    chips.push({
      key: `priority-${priority}`,
      label: `${PRIORITY_META[priority].label} priority`,
      clear: () => patch({ priorities: filters.priorities.filter((p) => p !== priority) }),
    })
  }
  for (const arrangement of filters.arrangements) {
    chips.push({
      key: `arr-${arrangement}`,
      label: WORK_ARRANGEMENT_LABEL[arrangement],
      clear: () => patch({ arrangements: filters.arrangements.filter((a) => a !== arrangement) }),
    })
  }
  for (const tag of filters.tags) {
    chips.push({ key: `tag-${tag}`, label: `#${tag}`, clear: () => patch({ tags: filters.tags.filter((t) => t !== tag) }) })
  }
  for (const source of filters.sources) {
    chips.push({
      key: `src-${source}`,
      label: source,
      clear: () => patch({ sources: filters.sources.filter((s) => s !== source) }),
    })
  }
  if (filters.locationQuery.trim()) {
    chips.push({ key: 'loc', label: `Location: ${filters.locationQuery}`, clear: () => patch({ locationQuery: '' }) })
  }
  if (filters.fitMin > 0 || filters.fitMax < 100) {
    chips.push({
      key: 'fit',
      label: `Fit ${filters.fitMin}–${filters.fitMax}`,
      clear: () => patch({ fitMin: 0, fitMax: 100 }),
    })
  }
  if (filters.dateWithinDays !== null) {
    chips.push({
      key: 'date',
      label: `${filters.dateField === 'dateApplied' ? 'Applied' : filters.dateField === 'updatedAt' ? 'Updated' : 'Discovered'} in ${filters.dateWithinDays}d`,
      clear: () => patch({ dateWithinDays: null }),
    })
  }
  if (filters.hasNextAction !== 'any') {
    chips.push({
      key: 'na',
      label:
        filters.hasNextAction === 'yes'
          ? 'Has next action'
          : filters.hasNextAction === 'no'
            ? 'No next action'
            : 'Overdue action',
      clear: () => patch({ hasNextAction: 'any' }),
    })
  }
  if (filters.archived !== 'active') {
    chips.push({
      key: 'arch',
      label: filters.archived === 'archived' ? 'Archived only' : 'Including archived',
      clear: () => patch({ archived: 'active' }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2 sm:px-6">
      <ListFilter className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex max-w-[14rem] items-center gap-1 rounded border border-line bg-subtle py-px pl-2 pr-1 text-2xs font-medium text-fg"
        >
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            onClick={chip.clear}
            aria-label={`Remove filter ${chip.label}`}
            className="rounded-sm p-0.5 text-faint transition-colors hover:bg-raised hover:text-fg"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <Button
        size="xs"
        variant="ghost"
        onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
        className="ml-1"
      >
        Clear all
      </Button>
    </div>
  )
}
