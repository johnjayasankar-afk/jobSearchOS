import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  CircleCheck,
  Flag,
  PenLine,
  Plus,
  Send,
  Users,
} from 'lucide-react'
import { PageHeader, SectionHeader } from '@/components/common'
import { WorkspaceNotices } from '@/components/WorkspaceNotices'
import { Button, EmptyState, Meter } from '@/components/ui/primitives'
import { Tooltip } from '@/components/ui/overlay'
import { useToast } from '@/components/ui/toast'
import { useWorkspace } from '@/state/workspace'
import { useActionRunner, useAppUi } from '@/state/app-ui'
import {
  buildAgenda,
  buildUpcoming,
  groupUpcoming,
  selectFocus,
  type ActionCommand,
  type ActionItem,
  type UpcomingEntry,
} from '@/lib/agenda'
import { computeMomentum } from '@/lib/analytics'
import { completeNextAction, updateInterview } from '@/lib/repo'
import { STAGE_META, type Stage } from '@/lib/types'
import { cn, formatLongDate, formatTime, pluralize } from '@/lib/utils'

export function TodayPage() {
  const ui = useAppUi()
  const toast = useToast()
  const run = useActionRunner()
  const workspace = useWorkspace()
  const [showAll, setShowAll] = React.useState(false)

  const agenda = React.useMemo(
    () =>
      buildAgenda({
        opportunities: workspace.opportunities,
        contacts: workspace.contacts,
        interviews: workspace.interviews,
        stories: workspace.stories,
        settings: workspace.settings,
      }),
    [
      workspace.opportunities,
      workspace.contacts,
      workspace.interviews,
      workspace.stories,
      workspace.settings,
    ],
  )

  const focus = React.useMemo(() => selectFocus(agenda, 5), [agenda])
  const shown = showAll ? agenda : focus
  const remaining = agenda.length - focus.length

  const upcoming = React.useMemo(
    () =>
      groupUpcoming(
        buildUpcoming({
          opportunities: workspace.opportunities,
          contacts: workspace.contacts,
          interviews: workspace.interviews,
        }),
      ),
    [workspace.opportunities, workspace.contacts, workspace.interviews],
  )

  const momentum = React.useMemo(
    () =>
      computeMomentum(workspace.opportunities, workspace.interviews, workspace.contacts, {
        applications: workspace.settings.weeklyApplicationTarget,
        networking: workspace.settings.weeklyNetworkingTarget,
      }),
    [workspace.opportunities, workspace.interviews, workspace.contacts, workspace.settings],
  )

  const execute = async (command: ActionCommand) => {
    if (command.kind === 'complete_next_action') {
      const undo = await completeNextAction(command.opportunityId)
      if (undo) toast.undoable('Marked done', undo.undo)
      return
    }
    if (command.kind === 'mark_followup_sent') {
      await updateInterview(command.interviewId, { followUpSent: true })
      toast.success('Follow-up recorded')
      return
    }
    run(command, {
      opportunities: workspace.byId,
      contacts: workspace.contactsById,
      interviews: workspace.interviewsById,
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Today" description={formatLongDate(new Date().toISOString())} />
      <WorkspaceNotices />

      <div className="grid flex-1 gap-6 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:gap-8">
        <section aria-labelledby="focus-heading" className="min-w-0">
          <SectionHeader
            title="Needs your attention"
            count={agenda.length || undefined}
            action={
              remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  className="text-xs font-medium text-muted transition-colors hover:text-fg"
                >
                  {showAll ? 'Show top 5' : `Show ${remaining} more`}
                </button>
              )
            }
          />
          <h2 id="focus-heading" className="sr-only">
            Prioritised actions
          </h2>

          {shown.length === 0 ? (
            <div className="mt-3 rounded-lg border border-line bg-panel">
              <EmptyState
                icon={<CircleCheck />}
                title={
                  workspace.opportunities.length === 0
                    ? 'Your workspace is empty'
                    : 'Nothing needs attention right now'
                }
                description={
                  workspace.opportunities.length === 0
                    ? 'Add the first opportunity you are considering and this page will tell you what to do next.'
                    : 'No overdue actions, no interviews in the next three days and no follow-ups due. Add a next action to anything you are actively pursuing to keep it moving.'
                }
                action={
                  workspace.opportunities.length === 0 ? (
                    <Button variant="primary" icon={<Plus />} onClick={() => ui.openAddOpportunity()}>
                      Add opportunity
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => ui.navigateTo('/pipeline')}>
                      Review the pipeline
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
              {shown.map((item) => (
                <ActionRow key={item.id} item={item} onCommand={execute} />
              ))}
            </ul>
          )}
        </section>

        <div className="min-w-0 space-y-6">
          <UpcomingPanel groups={upcoming} onOpen={execute} />
          <PipelineSnapshot />
          <MomentumPanel momentum={momentum} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- Action row ------------------------------- */

const URGENCY_STYLE: Record<ActionItem['urgency'], { dot: string; label: string }> = {
  overdue: { dot: 'bg-critical', label: 'text-critical' },
  today: { dot: 'bg-caution', label: 'text-caution' },
  soon: { dot: 'bg-accent', label: 'text-accent' },
  attention: { dot: 'bg-line-strong', label: 'text-muted' },
}

function ActionRow({
  item,
  onCommand,
}: {
  item: ActionItem
  onCommand: (command: ActionCommand) => void | Promise<void>
}) {
  const [busy, setBusy] = React.useState(false)
  const style = URGENCY_STYLE[item.urgency]

  const runCommand = async (command: ActionCommand) => {
    setBusy(true)
    try {
      await onCommand(command)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="group flex gap-3 px-3.5 py-3 transition-colors hover:bg-subtle/60 sm:px-4">
      <span className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-full', style.dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-balance text-md font-medium leading-snug text-fg">{item.title}</p>
          {item.dueLabel && (
            <span className={cn('shrink-0 text-xs font-medium tabular-nums', style.label)}>
              {item.dueLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">{item.context}</p>
        <p className="mt-1 text-sm leading-relaxed text-faint">{item.reason}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            icon={iconForCommand(item.primary.command)}
            onClick={() => void runCommand(item.primary.command)}
          >
            {item.primary.label}
          </Button>
          {item.secondary && (
            <Button size="sm" variant="ghost" onClick={() => void runCommand(item.secondary!.command)}>
              {item.secondary.label}
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}

function iconForCommand(command: ActionCommand): React.ReactNode {
  switch (command.kind) {
    case 'complete_next_action':
      return <Check />
    case 'mark_followup_sent':
      return <Send />
    case 'log_touch':
      return <Users />
    case 'draft_contact':
    case 'draft_interview':
      return <PenLine />
    case 'set_next_action':
      return <Flag />
    default:
      return <ArrowRight />
  }
}

/* -------------------------------- Upcoming -------------------------------- */

const UPCOMING_ICON: Record<UpcomingEntry['kind'], React.ReactNode> = {
  interview: <CalendarClock className="h-3.5 w-3.5 text-accent" aria-hidden />,
  next_action: <Flag className="h-3.5 w-3.5 text-muted" aria-hidden />,
  deadline: <CalendarDays className="h-3.5 w-3.5 text-caution" aria-hidden />,
  follow_up: <Users className="h-3.5 w-3.5 text-muted" aria-hidden />,
}

function UpcomingPanel({
  groups,
  onOpen,
}: {
  groups: Array<{ label: string; entries: UpcomingEntry[] }>
  onOpen: (command: ActionCommand) => void | Promise<void>
}) {
  const total = groups.reduce((a, g) => a + g.entries.length, 0)

  return (
    <section aria-labelledby="upcoming-heading">
      <SectionHeader title="Upcoming" count={total || undefined} />
      <h2 id="upcoming-heading" className="sr-only">
        Upcoming over the next two weeks
      </h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-line bg-panel">
        {total === 0 ? (
          <EmptyState
            compact
            title="Nothing scheduled"
            description="Interviews, dated next actions and follow-ups for the next two weeks appear here."
          />
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <p className="border-b border-line bg-subtle/60 px-3 py-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-faint">
                {group.label}
              </p>
              <ul className="divide-y divide-line">
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() =>
                        void onOpen(
                          entry.target.type === 'contact'
                            ? { kind: 'open_contact', contactId: entry.target.id }
                            : entry.target.type === 'interview'
                              ? { kind: 'open_interview', interviewId: entry.target.id }
                              : { kind: 'open_opportunity', opportunityId: entry.target.id },
                        )
                      }
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-subtle"
                    >
                      <span className="mt-0.5 shrink-0">{UPCOMING_ICON[entry.kind]}</span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-base text-fg',
                            // Only the generated interview labels need a capital.
                            entry.kind === 'interview' && 'first-letter:uppercase',
                          )}
                        >
                          {entry.title}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted">{entry.context}</span>
                      </span>
                      {entry.kind === 'interview' && (
                        <span className="shrink-0 text-xs tabular-nums text-muted">
                          {formatTime(entry.date)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

/* ---------------------------- Pipeline snapshot --------------------------- */

const SNAPSHOT_GROUPS: Array<{ label: string; stages: Stage[]; className: string }> = [
  { label: 'Exploring', stages: ['saved', 'evaluating'], className: 'bg-line-strong' },
  { label: 'Applying', stages: ['applying', 'applied'], className: 'bg-info' },
  {
    label: 'Interviewing',
    stages: ['recruiter_screen', 'hiring_manager', 'case_technical', 'onsite', 'final_round'],
    className: 'bg-accent',
  },
  { label: 'Offer', stages: ['offer'], className: 'bg-positive' },
]

function PipelineSnapshot() {
  const { opportunities } = useWorkspace()
  const active = opportunities.filter((o) => !o.archivedAt && STAGE_META[o.stage].active)
  const counts = SNAPSHOT_GROUPS.map((group) => ({
    ...group,
    count: active.filter((o) => group.stages.includes(o.stage)).length,
  }))
  const total = active.length

  return (
    <section aria-labelledby="snapshot-heading">
      <SectionHeader
        title="Pipeline"
        action={
          <Link to="/pipeline" className="text-xs font-medium text-muted transition-colors hover:text-fg">
            Open board
          </Link>
        }
      />
      <h2 id="snapshot-heading" className="sr-only">
        Pipeline snapshot
      </h2>
      <div className="mt-3 rounded-lg border border-line bg-panel p-3.5">
        {total === 0 ? (
          <p className="py-2 text-center text-sm text-faint">No active opportunities.</p>
        ) : (
          <>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-raised" aria-hidden>
              {counts
                .filter((c) => c.count > 0)
                .map((c) => (
                  <div
                    key={c.label}
                    className={cn('h-full', c.className)}
                    style={{ width: `${(c.count / total) * 100}%` }}
                    title={`${c.label}: ${c.count}`}
                  />
                ))}
            </div>
            <ul className="mt-3 space-y-1.5">
              {counts.map((c) => (
                <li key={c.label}>
                  <Link
                    to={`/opportunities?stage=${c.stages.join(',')}`}
                    className="flex items-center gap-2 rounded px-1 py-0.5 text-sm transition-colors hover:bg-subtle"
                  >
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', c.className)} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-muted">{c.label}</span>
                    <span className="shrink-0 tabular-nums text-fg">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-2.5 text-xs text-faint">
              {total} active {pluralize(total, 'opportunity', 'opportunities')}
            </p>
          </>
        )}
      </div>
    </section>
  )
}

/* -------------------------------- Momentum -------------------------------- */

function MomentumPanel({ momentum }: { momentum: ReturnType<typeof computeMomentum> }) {
  const { responseRate } = momentum

  return (
    <section aria-labelledby="momentum-heading">
      <SectionHeader
        title="Momentum"
        action={
          <Link to="/analytics" className="text-xs font-medium text-muted transition-colors hover:text-fg">
            Analytics
          </Link>
        }
      />
      <h2 id="momentum-heading" className="sr-only">
        This week's momentum
      </h2>
      <div className="mt-3 space-y-3 rounded-lg border border-line bg-panel p-3.5">
        {momentum.metrics.map((metric) => {
          const delta = metric.value - metric.previous
          return (
            <div key={metric.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm text-muted">{metric.label}</span>
                <span className="flex shrink-0 items-baseline gap-1.5">
                  <span className="text-md font-semibold tabular-nums text-fg">{metric.value}</span>
                  {metric.target !== undefined && (
                    <span className="text-xs tabular-nums text-faint">/ {metric.target}</span>
                  )}
                  <span
                    className={cn(
                      'w-10 text-right text-xs tabular-nums',
                      delta > 0 ? 'text-positive' : delta < 0 ? 'text-muted' : 'text-faint',
                    )}
                    title="Change from last week"
                  >
                    {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                  </span>
                </span>
              </div>
              {metric.target !== undefined && (
                <Meter
                  className="mt-1.5"
                  value={Math.min(metric.value, metric.target)}
                  max={metric.target}
                  tone={metric.value >= metric.target ? 'positive' : 'accent'}
                  label={`${metric.label}: ${metric.value} of ${metric.target}`}
                />
              )}
            </div>
          )
        })}

        <div className="border-t border-line pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted">Response rate</span>
            <span className="text-md font-semibold tabular-nums text-fg">
              {responseRate.value === null ? '—' : `${Math.round(responseRate.value * 100)}%`}
            </span>
          </div>
          <Tooltip
            content={
              responseRate.denominator === 0
                ? 'No applications in the last 90 days.'
                : `${responseRate.numerator} of ${responseRate.denominator} applications in the last 90 days got a reply — an interview or an explicit rejection.`
            }
          >
            <p className="mt-0.5 cursor-default text-xs text-faint">
              {responseRate.denominator === 0
                ? 'No applications in the last 90 days'
                : responseRate.reliable
                  ? `${responseRate.numerator} of ${responseRate.denominator} applications, last 90 days`
                  : `Only ${responseRate.denominator} ${pluralize(responseRate.denominator, 'application')} so far — too few to read much into`}
            </p>
          </Tooltip>
        </div>
      </div>
    </section>
  )
}
