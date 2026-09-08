import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Briefcase,
  Columns3,
  Download,
  Plus,
  Columns2,
  Rows3,
  SearchX,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/common'
import { Button, EmptyState, IconButton, Segmented } from '@/components/ui/primitives'
import {
  ConfirmDialog,
  Menu,
  MenuCheckItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@/components/ui/overlay'
import { Input, TagInput } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { ActiveFilterChips, FilterBar } from '@/components/opportunity/FilterBar'
import {
  OpportunityCards,
  OpportunityTable,
  type RowAction,
} from '@/components/opportunity/OpportunityTable'
import { OptionPicker } from '@/components/ui/OptionPicker'
import { Dot } from '@/components/ui/primitives'
import { PriorityGlyph } from '@/components/common'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { usePreferences, DEFAULT_COLUMNS } from '@/state/preferences'
import { applyFilters, COLUMNS, sortOpportunities } from '@/lib/filtering'
import {
  EMPTY_FILTERS,
  PRIORITY_META,
  STAGES,
  STAGE_META,
  type Opportunity,
  type OpportunityColumnId,
  type OpportunityFilters,
  type Priority,
  type Stage,
} from '@/lib/types'
import {
  addTagsTo,
  archiveOpportunities,
  bulkSetPriority,
  bulkSetStage,
  deleteOpportunities,
  deleteView,
  saveView,
  toggleViewPinned,
  updateOpportunity,
} from '@/lib/repo'
import { downloadFile, timestampedFilename } from '@/lib/backup'
import { OPPORTUNITY_CSV_HEADERS, opportunityToRow, toCsv } from '@/lib/csv'
import { useDebounced, useMediaQuery } from '@/hooks/useHotkeys'
import { pluralize } from '@/lib/utils'

/** Reads deep-link filters from the query string, ignoring anything unknown. */
function filtersFromParams(params: URLSearchParams): OpportunityFilters {
  const stages = (params.get('stage') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Stage => (STAGES as readonly string[]).includes(s))
  const priorities = (params.get('priority') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((p): p is Priority => ['high', 'medium', 'low'].includes(p))
  const archived = params.get('archived')
  return {
    ...EMPTY_FILTERS,
    query: params.get('q') ?? '',
    stages,
    priorities,
    archived: archived === 'archived' || archived === 'all' ? archived : 'active',
  }
}

const PAGE_SIZE = 100

export function OpportunitiesPage() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const { prefs, set, update } = usePreferences()
  const isDesktop = useMediaQuery('(min-width: 900px)')

  const [searchParams, setSearchParams] = useSearchParams()
  // Other pages can deep-link into a filtered list, e.g. `?stage=applied,offer`.
  const [filters, setFilters] = React.useState<OpportunityFilters>(() =>
    filtersFromParams(searchParams),
  )

  React.useEffect(() => {
    const viewParam = searchParams.get('view')
    const stageParam = searchParams.get('stage')
    const queryParam = searchParams.get('q')
    if (!stageParam && !queryParam && !viewParam) return

    if (viewParam) {
      const view = workspace.views.find((v) => v.id === viewParam)
      if (view) {
        setFilters(view.filters)
        update({ sortBy: view.sortBy, sortDir: view.sortDir, columns: view.columns })
      }
    } else {
      setFilters(filtersFromParams(searchParams))
    }
    // Consume the params so the filters stay editable without the URL fighting back.
    const next = new URLSearchParams(searchParams)
    for (const key of ['stage', 'q', 'priority', 'archived', 'view']) next.delete(key)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, workspace.views, update])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [limit, setLimit] = React.useState(PAGE_SIZE)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [rowPicker, setRowPicker] = React.useState<{
    kind: 'stage' | 'priority'
    row: Opportunity
  } | null>(null)
  const debouncedQuery = useDebounced(filters.query, 140)

  const effectiveFilters = React.useMemo(
    () => ({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery],
  )

  const filtered = React.useMemo(
    () => applyFilters(workspace.opportunities, effectiveFilters, workspace.fit),
    [workspace.opportunities, effectiveFilters, workspace.fit],
  )

  const sorted = React.useMemo(
    () => sortOpportunities(filtered, prefs.sortBy, prefs.sortDir, workspace.fit),
    [filtered, prefs.sortBy, prefs.sortDir, workspace.fit],
  )

  const visible = sorted.slice(0, limit)

  React.useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [effectiveFilters, prefs.sortBy, prefs.sortDir])

  // Drop selections that are no longer in the result set.
  React.useEffect(() => {
    setSelected((current) => {
      if (current.size === 0) return current
      const ids = new Set(sorted.map((o) => o.id))
      const next = new Set([...current].filter((id) => ids.has(id)))
      return next.size === current.size ? current : next
    })
  }, [sorted])

  const onSort = (column: OpportunityColumnId) => {
    if (prefs.sortBy === column) {
      set('sortDir', prefs.sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      update({ sortBy: column, sortDir: column === 'company' || column === 'role' ? 'asc' : 'desc' })
    }
  }

  /** Single-key actions on the row the keyboard is focused on. */
  const onRowAction = async (row: Opportunity, action: RowAction) => {
    if (action === 'stage' || action === 'priority') {
      setRowPicker({ kind: action, row })
      return
    }
    if (action === 'nextAction') {
      ui.openNextActionPrompt(row)
      return
    }
    const undo = await archiveOpportunities([row.id], !row.archivedAt)
    toast.undoable(row.archivedAt ? 'Restored from archive' : 'Archived', undo.undo, `${row.company} · ${row.role}`)
  }

  const exportCsv = () => {
    const rows = sorted.map((o) => opportunityToRow(o, workspace.fit.get(o.id)?.score ?? null))
    downloadFile(
      timestampedFilename('opportunities', 'csv'),
      toCsv([...OPPORTUNITY_CSV_HEADERS], rows),
      'text/csv',
    )
    toast.success(`Exported ${rows.length} ${pluralize(rows.length, 'opportunity', 'opportunities')}`)
  }

  const selectedIds = [...selected]
  const hasWorkspaceData = workspace.opportunities.length > 0

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Opportunities"
        actions={
          <>
            <Tooltip content="Export the current view as CSV">
              <Button size="sm" variant="secondary" icon={<Download />} onClick={exportCsv} disabled={sorted.length === 0}>
                <span className="hidden sm:inline">Export</span>
              </Button>
            </Tooltip>
            <SavedViewsMenu filters={filters} onApply={setFilters} />
            <ViewOptionsMenu />
            <Button size="sm" variant="primary" icon={<Plus />} onClick={() => ui.openAddOpportunity()}>
              <span className="hidden sm:inline">Add</span>
            </Button>
          </>
        }
      >
        <FilterBar
          filters={filters}
          onChange={setFilters}
          tags={workspace.allTags}
          sources={workspace.allSources}
          resultCount={sorted.length}
          totalCount={workspace.opportunities.length}
        />
        <ActiveFilterChips filters={filters} onChange={setFilters} />
      </PageHeader>

      {/* Filtering is a keyboard-driven activity; announce the outcome so it is
          not silent for anyone using a screen reader. */}
      <p aria-live="polite" className="sr-only">
        {sorted.length === workspace.opportunities.length
          ? `${sorted.length} ${pluralize(sorted.length, 'opportunity', 'opportunities')}`
          : `${sorted.length} of ${workspace.opportunities.length} opportunities match the current filters`}
      </p>

      <div className="min-h-0 flex-1">
        {!hasWorkspaceData ? (
          <EmptyState
            icon={<Briefcase />}
            title="No opportunities yet"
            description="Add the first role you are considering. Company and role are all you need to start — everything else can come later."
            action={
              <Button variant="primary" icon={<Plus />} onClick={() => ui.openAddOpportunity()}>
                Add opportunity
              </Button>
            }
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="Nothing matches these filters"
            description={
              filters.query
                ? `No opportunity matches “${filters.query}” with the filters you have set.`
                : 'Your filters exclude every opportunity in the workspace.'
            }
            action={
              <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            }
          />
        ) : isDesktop ? (
          <OpportunityTable
            rows={visible}
            columns={prefs.columns}
            sortBy={prefs.sortBy}
            sortDir={prefs.sortDir}
            onSort={onSort}
            selected={selected}
            onSelectedChange={setSelected}
            onOpen={(id) => ui.openOpportunity(id)}
            onRowAction={(row, action) => void onRowAction(row, action)}
            fit={workspace.fit}
            density={prefs.density}
          />
        ) : (
          <OpportunityCards
            rows={visible}
            onOpen={(id) => ui.openOpportunity(id)}
            fit={workspace.fit}
            selected={selected}
            onSelectedChange={setSelected}
          />
        )}

        {visible.length < sorted.length && (
          <div className="flex justify-center border-t border-line py-4">
            <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, sorted.length - visible.length)} more of {sorted.length}
            </Button>
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky bottom-0 z-20 border-t border-line bg-panel/95 px-4 py-2 shadow-lg backdrop-blur-md sm:px-6"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium tabular-nums text-fg">
              {selectedIds.length} selected
            </p>
            <div className="h-4 w-px bg-line" aria-hidden />

            <Menu>
              <MenuTrigger asChild>
                <Button size="sm" variant="secondary">
                  Set stage
                </Button>
              </MenuTrigger>
              <MenuContent align="start">
                {STAGES.map((stage: Stage) => (
                  <MenuItem
                    key={stage}
                    onSelect={async () => {
                      const undo = await bulkSetStage(selectedIds, stage)
                      toast.undoable(
                        `Moved ${selectedIds.length} to ${STAGE_META[stage].label}`,
                        undo.undo,
                      )
                      setSelected(new Set())
                    }}
                  >
                    {STAGE_META[stage].label}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>

            <Menu>
              <MenuTrigger asChild>
                <Button size="sm" variant="secondary">
                  Set priority
                </Button>
              </MenuTrigger>
              <MenuContent align="start">
                {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                  <MenuItem
                    key={p}
                    onSelect={async () => {
                      const undo = await bulkSetPriority(selectedIds, p)
                      toast.undoable(`Set ${selectedIds.length} to ${PRIORITY_META[p].label}`, undo.undo)
                      setSelected(new Set())
                    }}
                  >
                    {PRIORITY_META[p].label}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>

            {selectedIds.length >= 2 && selectedIds.length <= 4 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Columns2 />}
                onClick={() => ui.openCompare(selectedIds)}
              >
                Compare
              </Button>
            )}

            <BulkTagButton
              onApply={async (tags) => {
                const undo = await addTagsTo(selectedIds, tags)
                toast.undoable(`Tagged ${selectedIds.length} ${pluralize(selectedIds.length, 'opportunity', 'opportunities')}`, undo.undo)
                setSelected(new Set())
              }}
            />

            <Button
              size="sm"
              variant="secondary"
              icon={filters.archived === 'archived' ? <ArchiveRestore /> : <Archive />}
              onClick={async () => {
                const archiving = filters.archived !== 'archived'
                const undo = await archiveOpportunities(selectedIds, archiving)
                toast.undoable(
                  `${archiving ? 'Archived' : 'Restored'} ${selectedIds.length} ${pluralize(selectedIds.length, 'opportunity', 'opportunities')}`,
                  undo.undo,
                )
                setSelected(new Set())
              }}
            >
              {filters.archived === 'archived' ? 'Restore' : 'Archive'}
            </Button>

            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>

            <Button size="sm" variant="ghost" className="ml-auto" icon={<X />} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <OptionPicker
        open={rowPicker?.kind === 'stage'}
        onOpenChange={(open) => !open && setRowPicker(null)}
        title="Move to stage"
        description={rowPicker ? `${rowPicker.row.company} · ${rowPicker.row.role}` : undefined}
        value={rowPicker?.row.stage}
        options={STAGES.map((stage) => ({
          value: stage,
          label: STAGE_META[stage].label,
          icon: <Dot tone={STAGE_META[stage].tone} />,
          group:
            STAGE_META[stage].group === 'exploring'
              ? 'Exploring'
              : STAGE_META[stage].group === 'applying'
                ? 'Applying'
                : STAGE_META[stage].group === 'interviewing'
                  ? 'Interviewing'
                  : 'Closed',
        }))}
        onPick={async (stage: Stage) => {
          const row = rowPicker?.row
          if (!row || row.stage === stage) return
          const previous = row.stage
          await updateOpportunity(row.id, { stage })
          toast.undoable(`Moved to ${STAGE_META[stage].label}`, async () => {
            await updateOpportunity(row.id, { stage: previous })
          })
        }}
      />

      <OptionPicker
        open={rowPicker?.kind === 'priority'}
        onOpenChange={(open) => !open && setRowPicker(null)}
        title="Set priority"
        description={rowPicker ? `${rowPicker.row.company} · ${rowPicker.row.role}` : undefined}
        value={rowPicker?.row.priority}
        options={(['high', 'medium', 'low'] as Priority[]).map((p) => ({
          value: p,
          label: PRIORITY_META[p].label,
          icon: <PriorityGlyph priority={p} />,
        }))}
        onPick={async (priority: Priority) => {
          const row = rowPicker?.row
          if (!row || row.priority === priority) return
          const previous = row.priority
          await updateOpportunity(row.id, { priority })
          toast.undoable(`Priority set to ${PRIORITY_META[priority].label}`, async () => {
            await updateOpportunity(row.id, { priority: previous })
          })
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selectedIds.length} ${pluralize(selectedIds.length, 'opportunity', 'opportunities')}?`}
        destructive
        confirmLabel="Delete permanently"
        body={
          <p>
            Their interviews and activity history are removed too. Linked contacts are kept. You can undo
            this once from the notification.
          </p>
        }
        onConfirm={async () => {
          const count = selectedIds.length
          const undo = await deleteOpportunities(selectedIds)
          setSelected(new Set())
          toast.undoable(`Deleted ${count} ${pluralize(count, 'opportunity', 'opportunities')}`, undo.undo)
        }}
      />
    </div>
  )
}

/* ----------------------------- Bulk tag button ---------------------------- */

function BulkTagButton({ onApply }: { onApply: (tags: string[]) => void | Promise<void> }) {
  const { allTags } = useWorkspace()
  const [tags, setTags] = React.useState<string[]>([])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary" icon={<Tag />}>
          Add tags
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <TagInput ariaLabel="Tags to add" value={tags} onChange={setTags} suggestions={allTags} />
        <div className="mt-2 flex justify-end gap-2">
          <PopoverClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </PopoverClose>
          <PopoverClose asChild>
            <Button
              size="sm"
              variant="primary"
              disabled={tags.length === 0}
              onClick={() => {
                void onApply(tags)
                setTags([])
              }}
            >
              Add to selected
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------- Saved views ------------------------------ */

function SavedViewsMenu({
  filters,
  onApply,
}: {
  filters: OpportunityFilters
  onApply: (filters: OpportunityFilters) => void
}) {
  const { views } = useWorkspace()
  const { prefs } = usePreferences()
  const toast = useToast()
  const [name, setName] = React.useState('')
  const [saveOpen, setSaveOpen] = React.useState(false)

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" variant="secondary" icon={<Bookmark />}>
            <span className="hidden lg:inline">Views</span>
          </Button>
        </MenuTrigger>
        <MenuContent className="min-w-[14rem]">
          <MenuLabel>Saved views</MenuLabel>
          {views.length === 0 ? (
            <p className="px-2 py-2 text-sm text-faint">
              Save the filters you use every week and they show up here.
            </p>
          ) : (
            views.map((view) => (
              <MenuItem
                key={view.id}
                icon={view.pinned ? <BookmarkCheck /> : <Bookmark />}
                onSelect={() => onApply(view.filters)}
              >
                {view.name}
              </MenuItem>
            ))
          )}
          <MenuSeparator />
          <MenuItem icon={<BookmarkPlus />} onSelect={() => setSaveOpen(true)}>
            Save current view…
          </MenuItem>
          {views.length > 0 && (
            <>
              <MenuSeparator />
              <MenuLabel>Pin to the sidebar</MenuLabel>
              {views.map((view) => (
                <MenuCheckItem
                  key={`pin-${view.id}`}
                  checked={Boolean(view.pinned)}
                  onChange={() => void toggleViewPinned(view.id)}
                >
                  {view.name}
                </MenuCheckItem>
              ))}
              <MenuSeparator />
              <MenuLabel>Remove</MenuLabel>
              {views.map((view) => (
                <MenuItem
                  key={`del-${view.id}`}
                  icon={<Trash2 />}
                  destructive
                  onSelect={async () => {
                    const { undo } = await deleteView(view.id)
                    toast.undoable(`Removed the “${view.name}” view`, undo)
                  }}
                >
                  {view.name}
                </MenuItem>
              ))}
            </>
          )}
        </MenuContent>
      </Menu>

      <ConfirmDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save this view"
        confirmLabel="Save view"
        confirmDisabled={!name.trim()}
        body={
          <div className="space-y-2">
            <p>Filters, sorting and visible columns are stored together.</p>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High-priority remote roles"
              aria-label="View name"
            />
          </div>
        }
        onConfirm={async () => {
          const trimmed = name.trim() || 'Untitled view'
          await saveView({
            name: trimmed,
            filters,
            sortBy: prefs.sortBy,
            sortDir: prefs.sortDir,
            columns: prefs.columns,
          })
          setName('')
          toast.success(`Saved the “${trimmed}” view`)
        }}
      />
    </>
  )
}

/* ------------------------------ View options ------------------------------ */

function ViewOptionsMenu() {
  const { prefs, set } = usePreferences()

  const toggleColumn = (id: OpportunityColumnId, on: boolean) => {
    if (on) {
      // Preserve the canonical column order rather than append order.
      const next = COLUMNS.filter((c) => c.id === id || prefs.columns.includes(c.id)).map((c) => c.id)
      set('columns', next)
    } else {
      const next = prefs.columns.filter((c) => c !== id)
      set('columns', next.length > 0 ? next : ['company'])
    }
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label="View options" variant="secondary" size="sm">
          <Columns3 />
        </IconButton>
      </MenuTrigger>
      <MenuContent className="min-w-[13rem]">
        <MenuLabel>Row height</MenuLabel>
        <div className="px-2 pb-2 pt-0.5">
          <Segmented
            ariaLabel="Row height"
            size="sm"
            className="w-full [&>button]:flex-1"
            value={prefs.density}
            onChange={(density) => set('density', density)}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
        <MenuSeparator />
        <MenuLabel>Columns</MenuLabel>
        {COLUMNS.map((column) => (
          <MenuCheckItem
            key={column.id}
            checked={prefs.columns.includes(column.id)}
            onChange={(on) => toggleColumn(column.id, on)}
          >
            {column.label}
          </MenuCheckItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<Rows3 />} onSelect={() => set('columns', DEFAULT_COLUMNS)}>
          Reset columns
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
