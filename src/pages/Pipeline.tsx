import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { Columns3, Eye, EyeOff, GripVertical, Plus, Table2 } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { Button, EmptyState, Segmented } from '@/components/ui/primitives'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Tooltip } from '@/components/ui/overlay'
import { useToast } from '@/components/ui/toast'
import { CompanyMark, DueDate, PriorityGlyph } from '@/components/common'
import { OpportunityTable } from '@/components/opportunity/OpportunityTable'
import { useAppUi } from '@/state/app-ui'
import { usePreferences } from '@/state/preferences'
import { useWorkspace } from '@/state/workspace'
import { updateOpportunity } from '@/lib/repo'
import { ACTIVE_STAGES, PRIORITY_META, STAGE_META, type Opportunity, type Stage } from '@/lib/types'
import type { FitResult } from '@/lib/fit'
import { cn, formatCompact } from '@/lib/utils'
import { sortOpportunities } from '@/lib/filtering'
import { useMediaQuery } from '@/hooks/useHotkeys'

const EMPTY_SELECTION = new Set<string>()

export function PipelinePage() {
  const { prefs, set } = usePreferences()
  const workspace = useWorkspace()
  const ui = useAppUi()

  const active = React.useMemo(
    () => workspace.opportunities.filter((o) => !o.archivedAt && STAGE_META[o.stage].active),
    [workspace.opportunities],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Pipeline"
        description={`${active.length} active ${active.length === 1 ? 'opportunity' : 'opportunities'}`}
        actions={
          <>
            <Segmented
              ariaLabel="Pipeline layout"
              size="sm"
              value={prefs.pipelineView}
              onChange={(v) => set('pipelineView', v)}
              options={[
                { value: 'board', label: <Columns3 className="h-3.5 w-3.5" aria-hidden />, title: 'Board' },
                { value: 'table', label: <Table2 className="h-3.5 w-3.5" aria-hidden />, title: 'Table' },
              ]}
            />
            <Button size="sm" variant="primary" icon={<Plus />} onClick={() => ui.openAddOpportunity()}>
              <span className="hidden sm:inline">Add</span>
            </Button>
          </>
        }
      />

      {active.length === 0 ? (
        <EmptyState
          icon={<Columns3 />}
          title="Nothing in the pipeline"
          description="Opportunities you are actively pursuing appear here as a board. Closed and archived records stay out of the way."
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => ui.openAddOpportunity()}>
              Add opportunity
            </Button>
          }
        />
      ) : prefs.pipelineView === 'table' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <OpportunityTable
            rows={sortOpportunities(active, 'stage', 'desc', workspace.fit)}
            columns={prefs.columns}
            sortBy="stage"
            sortDir="desc"
            onSort={() => undefined}
            selected={EMPTY_SELECTION}
            onSelectedChange={() => undefined}
            selectable={false}
            onOpen={(id) => ui.openOpportunity(id)}
            fit={workspace.fit}
            density={prefs.density}
          />
        </div>
      ) : (
        <Board opportunities={active} />
      )}
    </div>
  )
}

/* ---------------------------------- Board --------------------------------- */

function Board({ opportunities }: { opportunities: Opportunity[] }) {
  const toast = useToast()
  const workspace = useWorkspace()
  const [dragging, setDragging] = React.useState<Opportunity | null>(null)
  const [showEmpty, setShowEmpty] = React.useState(false)
  // dnd-kit's drop animation is scripted, so the CSS reduced-motion rule cannot
  // reach it — turn it off here instead.
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const byStage = React.useMemo(() => {
    const map = new Map<Stage, Opportunity[]>()
    for (const stage of ACTIVE_STAGES) map.set(stage, [])
    for (const o of opportunities) map.get(o.stage)?.push(o)
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          PRIORITY_META[b.priority].weight - PRIORITY_META[a.priority].weight ||
          (a.nextActionDate ?? '9999').localeCompare(b.nextActionDate ?? '9999') ||
          b.updatedAt.localeCompare(a.updatedAt),
      )
    }
    return map
  }, [opportunities])

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setDragging(opportunities.find((o) => o.id === id) ?? null)
  }

  const onDragEnd = async (event: DragEndEvent) => {
    const moved = dragging
    setDragging(null)
    if (!event.over || !moved) return
    const target = String(event.over.id) as Stage
    if (!ACTIVE_STAGES.includes(target) || target === moved.stage) return
    const previousStage = moved.stage
    await updateOpportunity(moved.id, { stage: target })
    toast.undoable(
      `${moved.company} moved to ${STAGE_META[target].label}`,
      async () => {
        await updateOpportunity(moved.id, { stage: previousStage })
      },
      moved.role,
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      modifiers={[restrictToWindowEdges]}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${String(active.id)}`,
          onDragOver: ({ over }) =>
            over ? `Over the ${STAGE_META[String(over.id) as Stage]?.label ?? ''} column` : 'Not over a column',
          onDragEnd: ({ over }) =>
            over ? `Dropped in ${STAGE_META[String(over.id) as Stage]?.label ?? ''}` : 'Cancelled',
          onDragCancel: () => 'Move cancelled',
        },
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2 sm:px-6">
        <p className="text-xs text-faint">
          Drag a card to change its stage, or use the card menu — both work with a keyboard.
        </p>
        <Button
          size="xs"
          variant="ghost"
          icon={showEmpty ? <EyeOff /> : <Eye />}
          onClick={() => setShowEmpty((s) => !s)}
        >
          {showEmpty ? 'Collapse empty stages' : 'Show all stages'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-3 px-4 py-4 sm:px-6">
          {ACTIVE_STAGES.map((stage) => {
            const cards = byStage.get(stage) ?? []
            // Collapsed columns stay collapsed while dragging — expanding them
            // would shift every column sideways under the cursor mid-drop.
            const collapsed = cards.length === 0 && !showEmpty
            return (
              <Column
                key={stage}
                stage={stage}
                cards={cards}
                collapsed={collapsed}
                fit={workspace.fit}
                onExpand={() => setShowEmpty(true)}
              />
            )
          })}
        </div>
      </div>

      <DragOverlay
        dropAnimation={reduceMotion ? null : { duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}
      >
        {dragging && (
          <div className="w-[17rem] rotate-1 cursor-grabbing">
            <CardBody opportunity={dragging} fit={workspace.fit.get(dragging.id)} dragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  stage,
  cards,
  collapsed,
  fit,
  onExpand,
}: {
  stage: Stage
  cards: Opportunity[]
  collapsed: boolean
  fit: Map<string, FitResult>
  onExpand: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const meta = STAGE_META[stage]

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        ref={setNodeRef}
        aria-label={`${meta.label} column, empty. Drop here to move an opportunity to ${meta.label}, or select to show all stages`}
        className={cn(
          'flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg border border-dashed py-3 transition-colors',
          isOver
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-line bg-subtle/40 text-faint hover:border-line-strong hover:bg-subtle',
        )}
      >
        <span className="text-2xs tabular-nums">{isOver ? '+' : '0'}</span>
        <span className="[writing-mode:vertical-rl] text-xs">{meta.label}</span>
      </button>
    )
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={`${meta.label}, ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}
      className={cn(
        'flex h-full w-[17.5rem] shrink-0 flex-col rounded-lg border bg-subtle/40 transition-colors',
        isOver ? 'border-accent bg-accent-soft/50 ring-1 ring-accent/40' : 'border-line',
      )}
    >
      <header className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            meta.tone === 'positive'
              ? 'bg-positive'
              : meta.tone === 'accent'
                ? 'bg-accent'
                : meta.tone === 'info'
                  ? 'bg-info'
                  : 'bg-line-strong',
          )}
          aria-hidden
        />
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{meta.label}</h3>
        <span className="shrink-0 text-xs tabular-nums text-faint">{cards.length}</span>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {cards.length === 0 ? (
          <p
            className={cn(
              'rounded-md border border-dashed border-line px-3 py-6 text-center text-xs',
              isOver ? 'border-accent text-accent' : 'text-faint',
            )}
          >
            {isOver ? `Move to ${meta.label}` : 'Empty'}
          </p>
        ) : (
          cards.map((card) => <Card key={card.id} opportunity={card} fit={fit.get(card.id)} />)
        )}
      </div>
    </section>
  )
}

function Card({ opportunity, fit }: { opportunity: Opportunity; fit: FitResult | undefined }) {
  const ui = useAppUi()
  const toast = useToast()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opportunity.id })

  return (
    <div
      ref={setNodeRef}
      className={cn('group relative', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
      onClick={() => ui.openOpportunity(opportunity.id)}
      onKeyDown={(e) => {
        // dnd-kit owns Space/Enter while dragging; open on Enter otherwise.
        if (e.key === 'Enter' && !isDragging) {
          e.preventDefault()
          ui.openOpportunity(opportunity.id)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${opportunity.role} at ${opportunity.company}, ${STAGE_META[opportunity.stage].label}`}
    >
      <CardBody opportunity={opportunity} fit={fit} />
      <div className="absolute right-1 top-1" onClick={(e) => e.stopPropagation()}>
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label={`Move ${opportunity.role} to another stage`}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded p-1 text-faint opacity-0 transition-opacity hover:bg-raised hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>Move to stage</MenuLabel>
            {ACTIVE_STAGES.map((stage) => (
              <MenuItem
                key={stage}
                disabled={stage === opportunity.stage}
                onSelect={async () => {
                  const previous = opportunity.stage
                  await updateOpportunity(opportunity.id, { stage })
                  toast.undoable(`Moved to ${STAGE_META[stage].label}`, async () => {
                    await updateOpportunity(opportunity.id, { stage: previous })
                  })
                }}
              >
                {STAGE_META[stage].label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>
    </div>
  )
}

function CardBody({
  opportunity,
  fit,
  dragging,
}: {
  opportunity: Opportunity
  fit: FitResult | undefined
  dragging?: boolean
}) {
  return (
    <article
      className={cn(
        'cursor-grab rounded-md border border-line bg-panel p-2.5 text-left shadow-xs transition-shadow',
        dragging ? 'cursor-grabbing shadow-lg' : 'hover:shadow-sm',
      )}
    >
      <div className="flex items-center gap-1.5">
        <CompanyMark company={opportunity.company} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{opportunity.company}</span>
        <PriorityGlyph priority={opportunity.priority} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-muted" title={opportunity.role}>
        {opportunity.role}
      </p>

      <div className="mt-2 flex items-center gap-2 text-xs">
        {fit?.score !== null && fit?.score !== undefined && (
          <Tooltip content={fit.band}>
            <span
              className={cn(
                'shrink-0 font-semibold tabular-nums',
                fit.tone === 'positive'
                  ? 'text-positive'
                  : fit.tone === 'accent'
                    ? 'text-accent'
                    : fit.tone === 'caution'
                      ? 'text-caution'
                      : 'text-critical',
              )}
            >
              {fit.score}
            </span>
          </Tooltip>
        )}
        {(opportunity.salaryMax ?? opportunity.salaryMin) && (
          <span className="truncate tabular-nums text-faint">
            {formatCompact(opportunity.salaryMax ?? opportunity.salaryMin, opportunity.currency)}
          </span>
        )}
        {opportunity.location && (
          <span className="ml-auto min-w-0 truncate text-faint" title={opportunity.location}>
            {opportunity.location}
          </span>
        )}
      </div>

      {opportunity.nextAction && (
        <div className="mt-2 border-t border-line pt-2">
          <p className="truncate text-xs text-fg" title={opportunity.nextAction}>
            {opportunity.nextAction}
          </p>
          {opportunity.nextActionDate && <DueDate date={opportunity.nextActionDate} className="text-xs" />}
        </div>
      )}
    </article>
  )
}
