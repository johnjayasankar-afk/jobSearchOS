/**
 * The weekly review.
 *
 * A tracker tells you what is happening; a review is where you decide what to
 * stop. This assembles the last seven days from records that already exist —
 * what moved, what went quiet, what is coming — and hands each stalled item to
 * the UI with the decision still open. It recommends nothing.
 */
import {
  STAGE_META,
  type Contact,
  type Interview,
  type Opportunity,
  type Stage,
  type WorkspaceSettings,
} from './types'
import { daysSince, parseAnyDate, startOfDay } from './utils'

export const REVIEW_PERIOD_DAYS = 7

export interface StageMove {
  opportunity: Opportunity
  from: Stage | null
  to: Stage
  at: string
  /** True when the move was backwards or into a closed stage. */
  isSetback: boolean
  /** How many individual stage changes this row collapses. */
  steps: number
}

export interface StalledItem {
  opportunity: Opportunity
  reason: string
  days: number
}

export interface QuietContact {
  contact: Contact
  days: number | null
}

export interface WeeklyReview {
  periodStart: string
  periodEnd: string
  moved: StageMove[]
  applied: Opportunity[]
  added: Opportunity[]
  interviewsHeld: Interview[]
  outreach: Contact[]
  stalled: StalledItem[]
  quietContacts: QuietContact[]
  offersOpen: Opportunity[]
  /** True when there is genuinely nothing to look back on. */
  quiet: boolean
}

export interface ReviewInput {
  opportunities: Opportunity[]
  contacts: Contact[]
  interviews: Interview[]
  settings: WorkspaceSettings
  now?: Date
}

function within(value: string | undefined, from: Date, to: Date): boolean {
  const d = parseAnyDate(value)
  return Boolean(d && d >= from && d <= to)
}

export function buildWeeklyReview({
  opportunities,
  contacts,
  interviews,
  settings,
  now = new Date(),
}: ReviewInput): WeeklyReview {
  const end = now
  const start = new Date(startOfDay(now).getTime() - (REVIEW_PERIOD_DAYS - 1) * 86_400_000)

  /* -- what moved -- */
  // Collapsed to the net change per opportunity: a record nudged back and forth
  // during the week is one line, and one that ended where it started is none.
  const moved: StageMove[] = []
  for (const opportunity of opportunities) {
    const history = opportunity.stageHistory ?? []
    const inWindow: Array<{ from: Stage | null; to: Stage; at: string }> = []
    for (let i = 0; i < history.length; i++) {
      const visit = history[i]
      if (!visit || !within(visit.at, start, end)) continue
      inWindow.push({ from: i > 0 ? (history[i - 1]?.stage ?? null) : null, to: visit.stage, at: visit.at })
    }
    if (inWindow.length === 0) continue

    const first = inWindow[0]
    const last = inWindow[inWindow.length - 1]
    if (!first || !last) continue
    if (first.from === last.to) continue // ended the week where it started

    const forward = first.from ? STAGE_META[last.to].order > STAGE_META[first.from].order : true
    moved.push({
      opportunity,
      from: first.from,
      to: last.to,
      at: last.at,
      isSetback: !forward || !STAGE_META[last.to].active,
      steps: inWindow.length,
    })
  }
  moved.sort((a, b) => b.at.localeCompare(a.at))

  const applied = opportunities.filter((o) => within(o.dateApplied, start, end))
  const added = opportunities.filter((o) => within(o.dateDiscovered, start, end))
  const interviewsHeld = interviews
    .filter((iv) => {
      const at = parseAnyDate(iv.scheduledAt)
      return Boolean(at && at >= start && at <= end)
    })
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
  const outreach = contacts.filter((c) => within(c.lastContactDate, start, end))

  /* -- what went quiet -- */
  const stalled: StalledItem[] = []
  for (const opportunity of opportunities) {
    if (opportunity.archivedAt || !STAGE_META[opportunity.stage].active) continue

    const waiting = daysSince(opportunity.dateApplied)
    if (
      opportunity.stage === 'applied' &&
      waiting !== null &&
      waiting >= settings.applicationFollowUpDays &&
      !opportunity.nextAction
    ) {
      stalled.push({
        opportunity,
        days: waiting,
        reason: `Applied ${waiting} days ago with no reply and nothing planned.`,
      })
      continue
    }

    const idle = daysSince(opportunity.updatedAt)
    if (idle !== null && idle >= settings.staleOpportunityDays) {
      stalled.push({
        opportunity,
        days: idle,
        reason: `Untouched for ${idle} days, still sitting in ${STAGE_META[opportunity.stage].label}.`,
      })
    }
  }
  stalled.sort((a, b) => b.days - a.days)

  const activeIds = new Set(
    opportunities.filter((o) => !o.archivedAt && STAGE_META[o.stage].active).map((o) => o.id),
  )
  const quietContacts: QuietContact[] = contacts
    .filter((c) => !c.archivedAt && c.opportunityIds.some((id) => activeIds.has(id)))
    .map((c) => ({ contact: c, days: daysSince(c.lastContactDate) }))
    .filter((entry) => entry.days === null || entry.days >= settings.staleContactDays)
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))

  const offersOpen = opportunities.filter(
    (o) => !o.archivedAt && o.offer && o.offer.status !== 'declined' && o.offer.status !== 'expired',
  )

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    moved,
    applied,
    added,
    interviewsHeld,
    outreach,
    stalled,
    quietContacts,
    offersOpen,
    quiet:
      moved.length === 0 &&
      applied.length === 0 &&
      added.length === 0 &&
      interviewsHeld.length === 0 &&
      outreach.length === 0,
  }
}

/**
 * Whether it is worth offering a review: never reviewed and there is a week of
 * history to look at, or the last review has aged out.
 */
export function reviewIsDue(
  lastReviewAt: string | undefined,
  oldestRecordAt: string | undefined,
  now = new Date(),
): boolean {
  if (lastReviewAt) {
    const since = daysSince(lastReviewAt)
    return since !== null && since >= REVIEW_PERIOD_DAYS
  }
  const age = oldestRecordAt ? daysSince(oldestRecordAt) : null
  void now
  return age !== null && age >= REVIEW_PERIOD_DAYS
}
