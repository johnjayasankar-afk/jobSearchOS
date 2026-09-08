import * as React from 'react'
import { Check, Scale, Settings2, X } from 'lucide-react'
import { ConfirmDialog, Sheet } from '@/components/ui/overlay'
import { Badge, Button, IconButton } from '@/components/ui/primitives'
import { DueDate } from '@/components/common'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { useToast } from '@/components/ui/toast'
import { rateOpportunity, settleOffer } from '@/lib/repo'
import { buildDecision, compareDecisions, type Decision, type RatedCriterion } from '@/lib/decision'
import { offersInPlay } from '@/lib/offers'
import {
  DECISION_RATINGS,
  RATING_META,
  WEIGHT_META,
  type DecisionRating,
  type Opportunity,
} from '@/lib/types'
import { cn, formatMoney, pluralize } from '@/lib/utils'

/**
 * The decision.
 *
 * There is no score here and no recommendation, on purpose. Weighting a
 * three-point rating and printing 7.4 would be the false precision this product
 * refuses everywhere else — and worse, it would let you outsource the one call
 * that is genuinely yours.
 *
 * What it does instead: put the money in the context of what you said you
 * needed, show what you called decisive first, name the concerns you have
 * already written down against those things, and — when a second offer is live
 * — reduce the comparison to the handful of things you rated differently,
 * because that short list is the whole decision.
 */
export function DecisionSheet() {
  const ui = useAppUi()
  const workspace = useWorkspace()

  const opportunity = workspace.opportunities.find((o) => o.id === ui.decision.opportunityId)
  const criteria = workspace.settings.decisionCriteria ?? []

  const other = React.useMemo(() => {
    if (!opportunity) return null
    return offersInPlay(workspace.opportunities).find((o) => o.id !== opportunity.id) ?? null
  }, [workspace.opportunities, opportunity])

  const decision = React.useMemo(
    () => (opportunity ? buildDecision(opportunity, criteria, workspace.profile) : null),
    [opportunity, criteria, workspace.profile],
  )

  if (!opportunity || !decision) return null

  return (
    <Sheet
      open={ui.decision.open}
      onOpenChange={(open) => !open && ui.closeDecision()}
      title="Decide"
      width="xl"
      header={
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-[-0.012em] text-fg">
              {opportunity.company}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted">
              {opportunity.role}
              {opportunity.offer?.decisionDeadline && (
                <>
                  {' · '}
                  <DueDate date={opportunity.offer.decisionDeadline} className="text-sm" />
                </>
              )}
            </p>
          </div>
          <IconButton label="Close" onClick={() => ui.closeDecision()}>
            <X />
          </IconButton>
        </header>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <MoneyBlock decision={decision} opportunity={opportunity} />

        <section className="mt-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="section-title">What matters to you</h3>
            <Button
              size="sm"
              variant="ghost"
              icon={<Settings2 />}
              onClick={() => {
                ui.closeDecision()
                ui.navigateTo('/settings')
              }}
            >
              Edit the list
            </Button>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Your own judgement, recorded before the deadline does the deciding. Nothing here is
            scored or totalled — the point is to see what you already think.
          </p>

          {criteria.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
              No criteria yet. Settings → Workspace is where you say what you want from a role.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {decision.rated.map((row) => (
                <CriterionRow key={row.criterion.id} row={row} opportunityId={opportunity.id} />
              ))}
            </ul>
          )}
        </section>

        <TheRead decision={decision} />

        {other && <Against opportunity={opportunity} other={other} />}
      </div>

      <Settle opportunity={opportunity} />
    </Sheet>
  )
}

/**
 * The end of it.
 *
 * Reaching a conclusion and then having to go somewhere else to record it is
 * the sort of dead end that leaves offers sitting open in a pipeline for
 * months. Both buttons confirm, because both are hard to walk back.
 */
function Settle({ opportunity }: { opportunity: Opportunity }) {
  const ui = useAppUi()
  const toast = useToast()
  const [confirm, setConfirm] = React.useState<'accepted' | 'declined' | null>(null)
  const settled = opportunity.offer?.status === 'accepted' || opportunity.offer?.status === 'declined'

  if (settled) {
    return (
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
        <p className="text-sm text-muted">
          Recorded as{' '}
          <span className="font-medium text-fg">
            {opportunity.offer?.status === 'accepted' ? 'accepted' : 'declined'}
          </span>
          .
        </p>
        <Button variant="ghost" onClick={() => ui.closeDecision()}>
          Close
        </Button>
      </footer>
    )
  }

  return (
    <>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
        <p className="min-w-[12rem] flex-1 text-sm text-muted">
          When you have decided, record it here so the pipeline agrees with you.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setConfirm('declined')}>
            Decline
          </Button>
          <Button variant="primary" icon={<Check />} onClick={() => setConfirm('accepted')}>
            Accept
          </Button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === 'accepted' ? 'Accept this offer?' : 'Decline this offer?'}
        confirmLabel={confirm === 'accepted' ? 'Accept' : 'Decline'}
        destructive={confirm === 'declined'}
        body={
          <p>
            {confirm === 'accepted'
              ? `${opportunity.company} moves to accepted, and the offer is marked accepted. Nothing is sent to anyone — telling them is still your job.`
              : `${opportunity.company} moves to withdrawn, and the offer is marked declined. This can be undone.`}
          </p>
        }
        onConfirm={async () => {
          if (!confirm) return
          const { undo } = await settleOffer(opportunity.id, confirm)
          setConfirm(null)
          ui.closeDecision()
          toast.undoable(
            confirm === 'accepted' ? 'Offer accepted' : 'Offer declined',
            undo,
            opportunity.company,
          )
        }}
      />
    </>
  )
}

/* --------------------------------- money ---------------------------------- */

function MoneyBlock({ decision, opportunity }: { decision: Decision; opportunity: Opportunity }) {
  const { value, againstMinimum, againstRange, currencyMismatch } = decision.money
  const money = (n: number) => formatMoney(Math.round(n), value.currency ?? opportunity.currency ?? 'USD')

  if (!value.usable) {
    return (
      <section className="rounded-xl border border-dashed border-line px-4 py-5">
        <p className="text-base font-medium text-fg">The offer has no numbers on it yet</p>
        <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
          Add what you have to the offer on the opportunity and this fills in. Everything below works
          without it — money is rarely the part people get wrong.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-2xs uppercase tracking-[0.06em] text-faint">First year</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-fg">{money(value.firstYear)}</p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-[0.06em] text-faint">A steady year after that</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-muted">{money(value.steadyYear)}</p>
        </div>
        {value.total > 0 && (
          <div>
            <p className="text-2xs uppercase tracking-[0.06em] text-faint">
              Over {value.years} years
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-muted">{money(value.total)}</p>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1.5 border-t border-line pt-3">
        {againstMinimum && (
          <p className="text-sm leading-relaxed">
            <span className={againstMinimum.short ? 'text-caution' : 'text-positive'}>
              {againstMinimum.short ? 'Below' : 'Above'} the minimum you set
            </span>
            <span className="text-muted">
              {' '}
              by {money(Math.abs(againstMinimum.difference))} — you said {money(againstMinimum.minimum)}.
              {againstMinimum.short ? ' That is a negotiation before it is a decision.' : ''}
            </span>
          </p>
        )}
        {againstRange && (
          <p className="text-sm leading-relaxed text-muted">
            {againstRange.position === 'below'
              ? 'Below the range recorded for this role'
              : againstRange.position === 'above'
                ? 'Above the range recorded for this role'
                : 'Within the range recorded for this role'}
            {againstRange.min !== undefined && (
              <>
                {' '}
                ({money(againstRange.min)}
                {againstRange.max !== undefined ? `–${money(againstRange.max)}` : '+'})
              </>
            )}
            .
          </p>
        )}
        {currencyMismatch && (
          <p className="text-sm leading-relaxed text-caution">
            This offer is in {value.currency}, and your minimum is in another currency — the app will
            not convert them for you.
          </p>
        )}
        {value.missing.length > 0 && (
          <p className="text-sm leading-relaxed text-faint">
            Not counted, because it is not recorded: {value.missing.join(', ')}.
          </p>
        )}
      </div>
    </section>
  )
}

/* ------------------------------- the criteria ----------------------------- */

function CriterionRow({ row, opportunityId }: { row: RatedCriterion; opportunityId: string }) {
  const { criterion, rating } = row
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-panel px-3.5 py-2.5">
      <div className="min-w-[12rem] flex-1">
        <p className="text-base leading-snug text-fg">{criterion.label}</p>
        <p className="mt-0.5 text-2xs text-faint">{WEIGHT_META[criterion.weight].label}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={`How ${criterion.label} rates here`}
        className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-md border border-line bg-subtle p-0.5"
      >
        {DECISION_RATINGS.map((value) => {
          const on = rating === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => void rateOpportunity(opportunityId, criterion.id, on ? null : value)}
              className={cn(
                'rounded px-2 py-0.5 text-2xs font-medium transition-colors',
                on
                  ? value === 'concern'
                    ? 'bg-critical-soft text-critical shadow-xs'
                    : value === 'strength'
                      ? 'bg-positive-soft text-positive shadow-xs'
                      : 'bg-panel text-fg shadow-xs'
                  : 'text-muted hover:text-fg',
              )}
            >
              {RATING_META[value].label}
            </button>
          )
        })}
      </div>
    </li>
  )
}

/* -------------------------------- the read -------------------------------- */

function TheRead({ decision }: { decision: Decision }) {
  const decisiveConcerns = decision.concerns.filter((c) => c.criterion.weight === 3)
  const lines: React.ReactNode[] = []

  if (decisiveConcerns.length > 0) {
    lines.push(
      <>
        You have a concern against{' '}
        <span className="font-medium text-fg">
          {decisiveConcerns.map((c) => c.criterion.label.toLowerCase()).join(' and ')}
        </span>
        , which you called decisive. That is the thing to resolve before saying yes.
      </>,
    )
  } else if (decision.concerns.length > 0) {
    lines.push(
      <>
        Nothing you called decisive is a concern, but{' '}
        <span className="font-medium text-fg">
          {decision.concerns.map((c) => c.criterion.label.toLowerCase()).join(', ')}
        </span>{' '}
        {decision.concerns.length === 1 ? 'is' : 'are'} marked as one.
      </>,
    )
  }

  if (decision.unrated.length > 0) {
    lines.push(
      <>
        {decision.unrated.length} {pluralize(decision.unrated.length, 'thing')} that{' '}
        {decision.unrated.length === 1 ? 'matters is' : 'matter are'} still unjudged
        {decision.unrated.length <= 3 && (
          <> — {decision.unrated.map((c) => c.criterion.label.toLowerCase()).join(', ')}</>
        )}
        . Those are the questions worth asking before the deadline.
      </>,
    )
  }

  if (lines.length === 0 && decision.rated.some((r) => r.rating !== null)) {
    lines.push(<>You have judged everything that matters and recorded no concerns against it.</>)
  }

  if (lines.length === 0) return null

  return (
    <section className="mt-6 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Scale className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1.5">
          {lines.map((line, i) => (
            <p key={i} className="text-base leading-relaxed text-muted">
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------- two offers ------------------------------- */

function Against({ opportunity, other }: { opportunity: Opportunity; other: Opportunity }) {
  const workspace = useWorkspace()
  const criteria = workspace.settings.decisionCriteria ?? []
  const comparison = React.useMemo(
    () => compareDecisions(opportunity, other, criteria),
    [opportunity, other, criteria],
  )

  return (
    <section className="mt-7">
      <h3 className="section-title">Against {other.company}</h3>
      {comparison.tied ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          You have rated these two the same on everything you have judged. Either the difference is
          in something not on your list, or it is in the money — worth saying out loud rather than
          deciding by feel.
        </p>
      ) : (
        <>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            {comparison.same.length > 0 ? (
              <>
                You rated them the same on {comparison.same.length}{' '}
                {pluralize(comparison.same.length, 'thing')}. These are where they differ, and this
                short list is the decision.
              </>
            ) : (
              <>Where the two differ on what you have judged.</>
            )}
          </p>
          {/* A labelled grid rather than two chips and an arrow: which column
              belongs to which company should never need decoding. */}
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-x-3 border-b border-line bg-subtle/60 px-3.5 py-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
              <span className="text-2xs uppercase tracking-[0.06em] text-faint">Criterion</span>
              <span className="truncate text-2xs font-medium text-fg" title={opportunity.company}>
                {opportunity.company}
              </span>
              <span className="truncate text-2xs font-medium text-muted" title={other.company}>
                {other.company}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {comparison.differ.map((d) => (
                <li
                  key={d.criterion.id}
                  className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-x-3 bg-panel px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]"
                >
                  <div className="min-w-0">
                    <p className="text-base leading-snug text-fg">{d.criterion.label}</p>
                    <p className="mt-0.5 text-2xs text-faint">
                      {WEIGHT_META[d.criterion.weight].label}
                    </p>
                  </div>
                  <RatingChip rating={d.a} />
                  <RatingChip rating={d.b} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}

function RatingChip({ rating }: { rating: DecisionRating | null }) {
  if (!rating) return <span className="text-2xs text-faint">not judged</span>
  return (
    <span className="min-w-0">
      <Badge tone={RATING_META[rating].tone}>{RATING_META[rating].label}</Badge>
    </span>
  )
}
