import * as React from 'react'
import {
  Archive,
  ArrowRight,
  CalendarClock,
  Check,
  Download,
  Flag,
  Send,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { Sheet } from '@/components/ui/overlay'
import { Badge, Button, IconButton } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { StageBadge } from '@/components/common'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { archiveOpportunities, updateSettings } from '@/lib/repo'
import { buildWeeklyReview, REVIEW_PERIOD_DAYS } from '@/lib/review'
import {
  buildWorkspaceExport,
  downloadFile,
  markBackupTaken,
  timestampedFilename,
} from '@/lib/backup'
import { STAGE_META } from '@/lib/types'
import { cn, formatDate, formatLongDate } from '@/lib/utils'

/**
 * Seven days, in one pass.
 *
 * The point is not the summary — it is the second half, where everything that
 * has gone quiet is put in front of you with the decision still open. Plan it,
 * archive it, or leave it; the review does not choose.
 */
export function WeeklyReview() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const [exporting, setExporting] = React.useState(false)

  const review = React.useMemo(
    () =>
      buildWeeklyReview({
        opportunities: workspace.opportunities,
        contacts: workspace.contacts,
        interviews: workspace.interviews,
        settings: workspace.settings,
      }),
    [workspace.opportunities, workspace.contacts, workspace.interviews, workspace.settings],
  )

  const finish = async () => {
    await updateSettings({ lastReviewAt: new Date().toISOString() })
    ui.closeReview()
    toast.success('Week closed', 'The next review is offered in seven days.')
  }

  return (
    <Sheet
      open={ui.review.open}
      onOpenChange={(open) => !open && ui.closeReview()}
      title="Weekly review"
      width="xl"
      header={
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-[-0.012em] text-fg">Weekly review</h2>
            <p className="mt-0.5 text-sm text-muted">
              {formatDate(review.periodStart)} – {formatLongDate(review.periodEnd)}
            </p>
          </div>
          <IconButton label="Close the review" onClick={() => ui.closeReview()}>
            <X />
          </IconButton>
        </header>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {review.quiet ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
            <p className="text-base font-medium text-fg">Nothing moved in the last {REVIEW_PERIOD_DAYS} days</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">
              No applications, interviews or outreach were recorded. That is worth knowing on its own — the
              second half of this review shows what has been waiting.
            </p>
          </div>
        ) : (
          <section>
            <h3 className="section-title">What moved</h3>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line pb-5 sm:grid-cols-4">
              <Metric icon={<Send />} label="Applications sent" value={review.applied.length} />
              <Metric icon={<CalendarClock />} label="Interviews held" value={review.interviewsHeld.length} />
              <Metric icon={<Users />} label="People contacted" value={review.outreach.length} />
              <Metric icon={<TrendingUp />} label="Roles added" value={review.added.length} />
            </div>

            {review.moved.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {review.moved.slice(0, 12).map((move, i) => (
                  <li key={`${move.opportunity.id}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-fg">
                      {move.opportunity.company}
                      <span className="text-muted"> · {move.opportunity.role}</span>
                      {move.steps > 1 && (
                        <span className="text-faint"> · {move.steps} changes</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {move.from && (
                        <>
                          <span className="text-xs text-faint">{STAGE_META[move.from].label}</span>
                          <ArrowRight className="h-3 w-3 text-faint" aria-hidden />
                        </>
                      )}
                      <StageBadge stage={move.to} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {review.offersOpen.length > 0 && (
          <section className="mt-6">
            <h3 className="section-title">Offers on the table</h3>
            <ul className="mt-2 space-y-1.5">
              {review.offersOpen.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-md border border-positive/30 bg-positive-soft/40 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-base text-fg">
                    {o.company}
                    <span className="text-muted"> · {o.role}</span>
                  </span>
                  {o.offer?.decisionDeadline && (
                    <Badge tone="caution">Decide by {formatDate(o.offer.decisionDeadline)}</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      ui.closeReview()
                      ui.openOpportunity(o.id)
                    }}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h3 className="section-title">
            What has gone quiet
            {review.stalled.length > 0 && <span className="ml-1.5 tabular-nums">{review.stalled.length}</span>}
          </h3>
          {review.stalled.length === 0 ? (
            <p className="mt-2 rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
              Nothing is stalled. Every active opportunity has been touched recently or has a plan.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                Each of these is waiting on you. Give it a next step, or let it go — leaving it undecided is
                what turns a pipeline into a list.
              </p>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
                {review.stalled.map(({ opportunity, reason }) => (
                  <li key={opportunity.id} className="flex flex-wrap items-center gap-3 bg-panel px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-fg">
                        {opportunity.company}
                        <span className="font-normal text-muted"> · {opportunity.role}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-muted">{reason}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Flag />}
                      onClick={() => ui.openNextActionPrompt(opportunity)}
                    >
                      Plan it
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Archive />}
                      onClick={async () => {
                        const undo = await archiveOpportunities([opportunity.id], true)
                        toast.undoable('Archived', undo.undo, `${opportunity.company} · ${opportunity.role}`)
                      }}
                    >
                      Let it go
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {review.quietContacts.length > 0 && (
          <section className="mt-6">
            <h3 className="section-title">People worth a note</h3>
            <p className="mt-1 text-sm text-muted">
              Attached to something live, and not spoken to in a while.
            </p>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {review.quietContacts.slice(0, 8).map(({ contact, days }) => (
                <li key={contact.id} className="flex flex-wrap items-center gap-3 bg-panel px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-fg">{contact.name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {[contact.title, contact.company].filter(Boolean).join(' · ')}
                      {days === null ? ' · never contacted' : ` · ${days} days quiet`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      ui.openComposer({
                        kind: 'contact',
                        contactId: contact.id,
                        opportunityId: contact.opportunityIds[0],
                      })
                    }
                  >
                    Draft a note
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
        <Button
          variant="ghost"
          icon={<Download />}
          loading={exporting}
          onClick={async () => {
            setExporting(true)
            try {
              const payload = await buildWorkspaceExport()
              downloadFile(
                timestampedFilename('opportunity-os-workspace', 'json'),
                JSON.stringify(payload, null, 2),
                'application/json',
              )
              await markBackupTaken()
              toast.success('Backup exported')
            } catch (error) {
              toast.error('Export failed', error instanceof Error ? error.message : undefined)
            } finally {
              setExporting(false)
            }
          }}
        >
          Export a backup while you are here
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => ui.closeReview()}>
            Not now
          </Button>
          <Button variant="primary" icon={<Check />} onClick={() => void finish()}>
            Done for this week
          </Button>
        </div>
      </footer>
    </Sheet>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="min-w-0">
      <span
        className={cn('flex items-center gap-1.5 text-xs', value > 0 ? 'text-muted' : 'text-faint')}
        aria-hidden
      >
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', value > 0 ? 'text-fg' : 'text-faint')}>
        {value}
      </p>
    </div>
  )
}
