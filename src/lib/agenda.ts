/**
 * The action-priority engine behind Today.
 *
 * Every candidate action is produced by a named, deterministic signal with an
 * explicit score. Nothing is random and nothing is inferred by a model — the
 * `reason` string on each item is the literal rule that fired, so the user can
 * always see why something reached the top of the list.
 */
import {
  PRIORITY_META,
  STAGE_META,
  type Contact,
  type Interview,
  type Opportunity,
  type Story,
  type WorkspaceSettings,
} from './types'
import { debriefIsDue, outcomeIsDue, rehearsalReadiness } from './rehearsal'
import { daysFromToday, daysSince, formatDate, parseAnyDate, today } from './utils'

export type ActionKind =
  | 'next_action_overdue'
  | 'next_action_today'
  | 'interview_prep'
  | 'interview_rehearse'
  | 'interview_debrief'
  | 'interview_outcome'
  | 'interview_followup'
  | 'application_deadline'
  | 'awaiting_response'
  | 'no_next_action'
  | 'stale_opportunity'
  | 'evaluation_stalled'
  | 'contact_followup'
  | 'contact_stale'
  | 'offer_decision'

export type Urgency = 'overdue' | 'today' | 'soon' | 'attention'

export interface ActionTarget {
  type: 'opportunity' | 'contact' | 'interview'
  id: string
}

export type ActionCommand =
  | { kind: 'complete_next_action'; opportunityId: string }
  | { kind: 'draft_contact'; contactId: string; opportunityId?: string }
  | { kind: 'draft_interview'; interviewId: string }
  | { kind: 'log_touch'; contactId: string }
  | { kind: 'mark_followup_sent'; interviewId: string }
  | { kind: 'set_next_action'; opportunityId: string }
  | { kind: 'open_opportunity'; opportunityId: string }
  | { kind: 'open_interview'; interviewId: string }
  | { kind: 'open_contact'; contactId: string }
  | { kind: 'rehearse_interview'; interviewId: string }
  | { kind: 'debrief_interview'; interviewId: string }
  | { kind: 'record_outcome'; interviewId: string }
  | { kind: 'decide_offer'; opportunityId: string }

export interface ActionItem {
  id: string
  kind: ActionKind
  score: number
  urgency: Urgency
  /** Imperative statement of the work to do. */
  title: string
  /** Where it belongs, e.g. "Northwind Labs · Senior PM". */
  context: string
  /** Why this surfaced, in the user's language. */
  reason: string
  dueLabel?: string
  target: ActionTarget
  opportunityId?: string
  primary: { label: string; command: ActionCommand }
  secondary?: { label: string; command: ActionCommand }
}

export interface AgendaInput {
  opportunities: Opportunity[]
  contacts: Contact[]
  interviews: Interview[]
  /** Optional: without them, the rehearsal signal simply never fires. */
  stories?: Story[]
  settings: WorkspaceSettings
  /** Injected so tests are deterministic. */
  now?: Date
}

const PRIORITY_BONUS: Record<string, number> = { high: 14, medium: 6, low: 0 }

function contextFor(o: Opportunity): string {
  return `${o.company} · ${o.role}`
}

/** Builds the full ranked candidate list. */
export function buildAgenda(input: AgendaInput): ActionItem[] {
  const { opportunities, contacts, interviews, stories = [], settings } = input
  const now = input.now ?? new Date()
  const items: ActionItem[] = []
  const byId = new Map(opportunities.map((o) => [o.id, o]))
  const active = opportunities.filter((o) => !o.archivedAt && STAGE_META[o.stage].active)

  /* ---- Next actions ---------------------------------------------------- */
  for (const o of active) {
    if (!o.nextAction) continue
    const days = daysFromToday(o.nextActionDate)
    if (days === null) continue
    if (days < 0) {
      items.push({
        id: `na-${o.id}`,
        kind: 'next_action_overdue',
        score: 200 + Math.min(Math.abs(days), 30) * 3 + (PRIORITY_BONUS[o.priority] ?? 0),
        urgency: 'overdue',
        title: o.nextAction,
        context: contextFor(o),
        reason: `Next action was due ${formatDate(o.nextActionDate)} — ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago.`,
        dueLabel: `${Math.abs(days)}d overdue`,
        target: { type: 'opportunity', id: o.id },
        opportunityId: o.id,
        primary: { label: 'Mark done', command: { kind: 'complete_next_action', opportunityId: o.id } },
        secondary: { label: 'Open', command: { kind: 'open_opportunity', opportunityId: o.id } },
      })
    } else if (days === 0) {
      items.push({
        id: `na-${o.id}`,
        kind: 'next_action_today',
        score: 150 + (PRIORITY_BONUS[o.priority] ?? 0),
        urgency: 'today',
        title: o.nextAction,
        context: contextFor(o),
        reason: 'Next action is scheduled for today.',
        dueLabel: 'Due today',
        target: { type: 'opportunity', id: o.id },
        opportunityId: o.id,
        primary: { label: 'Mark done', command: { kind: 'complete_next_action', opportunityId: o.id } },
        secondary: { label: 'Open', command: { kind: 'open_opportunity', opportunityId: o.id } },
      })
    }
  }

  /* ---- Interviews ------------------------------------------------------- */
  for (const iv of interviews) {
    const o = byId.get(iv.opportunityId)
    if (!o || o.archivedAt) continue
    const when = parseAnyDate(iv.scheduledAt)
    if (!when) continue
    const hoursOut = (when.getTime() - Date.now()) / 3_600_000
    const typeLabel = iv.type.replace(/_/g, ' ')

    if (iv.outcome === 'pending' && hoursOut > -2 && hoursOut <= 72) {
      const openChecklist = iv.checklist.filter((c) => !c.done).length
      const prepThin = openChecklist > 0 || !iv.prepNotes || iv.storyIds.length === 0
      // Calendar days, not elapsed hours: an interview at 2pm tomorrow is 18
      // hours away, and calling that "today" is how someone loses an evening
      // of prep they thought they still had.
      const daysOut = daysFromToday(iv.scheduledAt, now) ?? 0
      const dayLabel = daysOut <= 0 ? 'today' : daysOut === 1 ? 'tomorrow' : `in ${daysOut} days`
      const dueLabel = daysOut <= 0 ? 'Today' : daysOut === 1 ? 'Tomorrow' : `${daysOut} days`
      items.push({
        id: `iv-${iv.id}`,
        kind: 'interview_prep',
        score: (hoursOut < 24 ? 240 : hoursOut < 48 ? 190 : 140) + (prepThin ? 15 : 0),
        urgency: hoursOut < 24 ? 'today' : 'soon',
        title: prepThin ? `Prepare for the ${typeLabel} interview` : `${typeLabel} interview ${dayLabel}`,
        context: contextFor(o),
        reason: prepThin
          ? `Interview is ${dayLabel} and ${openChecklist > 0 ? `${openChecklist} prep ${openChecklist === 1 ? 'item is' : 'items are'} still open` : 'prep notes are empty'}.`
          : `Interview is ${dayLabel}.`,
        dueLabel,
        target: { type: 'interview', id: iv.id },
        opportunityId: o.id,
        primary: { label: 'Open prep', command: { kind: 'open_interview', interviewId: iv.id } },
        secondary: { label: 'Opportunity', command: { kind: 'open_opportunity', opportunityId: o.id } },
      })

      // Pinning a story to an interview is not the same as being able to tell
      // it. This fires only when stories are pinned and some are unpractised,
      // so it never nags someone who has not chosen their answers yet.
      const readiness = rehearsalReadiness(iv.storyIds, stories, now)
      if (readiness.total > 0 && readiness.needWork.length > 0) {
        const count = readiness.needWork.length
        items.push({
          id: `ivr-${iv.id}`,
          kind: 'interview_rehearse',
          score: (hoursOut < 24 ? 205 : hoursOut < 48 ? 165 : 125) + count * 3,
          urgency: hoursOut < 24 ? 'today' : 'soon',
          title: `Rehearse your stories for the ${typeLabel} interview`,
          context: contextFor(o),
          reason: `${count} of ${readiness.total} pinned ${readiness.total === 1 ? 'story is' : 'stories are'} untested or went badly last time, and the interview is ${dayLabel}.`,
          dueLabel,
          target: { type: 'interview', id: iv.id },
          opportunityId: o.id,
          primary: { label: 'Rehearse', command: { kind: 'rehearse_interview', interviewId: iv.id } },
          secondary: { label: 'Open prep', command: { kind: 'open_interview', interviewId: iv.id } },
        })
      }
    }

    // The debrief has the shortest shelf life of anything in the app: it ranks
    // above the follow-up on the day, because the follow-up can be written from
    // notes and the notes cannot be written from memory a week later.
    if (debriefIsDue(iv, now)) {
      const sinceDays = Math.max(0, daysSince(iv.scheduledAt, now) ?? 0)
      const fresh = sinceDays === 0
      items.push({
        id: `ivd-${iv.id}`,
        kind: 'interview_debrief',
        score: fresh ? 215 : 175 - sinceDays * 10,
        urgency: fresh ? 'today' : 'soon',
        title: `Debrief the ${typeLabel} interview`,
        context: contextFor(o),
        reason: fresh
          ? 'It happened today. Write down what they asked while you can still remember it.'
          : `It was ${sinceDays} ${sinceDays === 1 ? 'day' : 'days'} ago — what they asked is still worth recording.`,
        dueLabel: fresh ? 'Today' : `${sinceDays}d ago`,
        target: { type: 'interview', id: iv.id },
        opportunityId: o.id,
        primary: { label: 'Debrief', command: { kind: 'debrief_interview', interviewId: iv.id } },
        secondary: { label: 'Opportunity', command: { kind: 'open_opportunity', opportunityId: o.id } },
      })
    }

    // An interview with no result is a hole in the record: the round analysis
    // cannot see it, and the pipeline still shows it as live.
    if (outcomeIsDue(iv, now)) {
      const waiting = Math.max(0, daysSince(iv.scheduledAt, now) ?? 0)
      items.push({
        id: `ivo-${iv.id}`,
        kind: 'interview_outcome',
        score: 96 + Math.min(waiting, 20),
        urgency: 'attention',
        title: `Did you hear back about the ${typeLabel} interview?`,
        context: contextFor(o),
        reason: `It was ${waiting} days ago and no result is recorded. Without one it is missing from what you get past and what ends it.`,
        dueLabel: `${waiting}d ago`,
        target: { type: 'interview', id: iv.id },
        opportunityId: o.id,
        primary: { label: 'Record it', command: { kind: 'record_outcome', interviewId: iv.id } },
        secondary: { label: 'Opportunity', command: { kind: 'open_opportunity', opportunityId: o.id } },
      })
    }

    const daysSinceInterview = when.getTime() < Date.now() ? Math.floor((Date.now() - when.getTime()) / 86_400_000) : -1
    if (
      !iv.followUpSent &&
      iv.outcome !== 'cancelled' &&
      daysSinceInterview >= 0 &&
      daysSinceInterview <= 30
    ) {
      const overdue = daysSinceInterview >= settings.interviewFollowUpDays
      items.push({
        id: `ivf-${iv.id}`,
        kind: 'interview_followup',
        score: (overdue ? 185 : 120) + Math.min(daysSinceInterview, 10) * 2,
        urgency: overdue ? 'overdue' : 'today',
        title: `Send a follow-up after the ${typeLabel} interview`,
        context: contextFor(o),
        reason: overdue
          ? `The interview was ${daysSinceInterview === 0 ? 'today' : `${daysSinceInterview}d ago`} and no follow-up is recorded (your threshold is ${settings.interviewFollowUpDays}d).`
          : 'The interview just happened — a same-day note lands best.',
        dueLabel: overdue ? `${daysSinceInterview}d ago` : 'Today',
        target: { type: 'interview', id: iv.id },
        opportunityId: o.id,
        primary: { label: 'Draft it', command: { kind: 'draft_interview', interviewId: iv.id } },
        secondary: { label: 'Mark sent', command: { kind: 'mark_followup_sent', interviewId: iv.id } },
      })
    }
  }

  /* ---- Deadlines, waiting, staleness ------------------------------------ */
  for (const o of active) {
    const deadlineDays = daysFromToday(o.deadline)
    if (deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7 && !o.dateApplied) {
      items.push({
        id: `dl-${o.id}`,
        kind: 'application_deadline',
        score: 210 - deadlineDays * 12 + (PRIORITY_BONUS[o.priority] ?? 0),
        urgency: deadlineDays <= 1 ? 'overdue' : 'soon',
        title: `Apply before the ${formatDate(o.deadline)} deadline`,
        context: contextFor(o),
        reason: `The posting closes in ${deadlineDays === 0 ? 'less than a day' : `${deadlineDays} ${deadlineDays === 1 ? 'day' : 'days'}`} and you have not applied.`,
        dueLabel: deadlineDays === 0 ? 'Today' : `${deadlineDays}d`,
        target: { type: 'opportunity', id: o.id },
        opportunityId: o.id,
        primary: { label: 'Open', command: { kind: 'open_opportunity', opportunityId: o.id } },
      })
    }

    if (o.offer?.decisionDeadline) {
      const d = daysFromToday(o.offer.decisionDeadline)
      if (d !== null && d <= 10) {
        items.push({
          id: `of-${o.id}`,
          kind: 'offer_decision',
          score: 260 - Math.max(d, 0) * 8,
          urgency: d <= 0 ? 'overdue' : 'soon',
          title: d < 0 ? 'Offer decision date has passed' : 'Decide on the offer',
          context: contextFor(o),
          reason:
            d < 0
              ? `The decision deadline was ${formatDate(o.offer.decisionDeadline)}.`
              : `You have ${d} ${d === 1 ? 'day' : 'days'} to respond to this offer.`,
          dueLabel: d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`,
          target: { type: 'opportunity', id: o.id },
          opportunityId: o.id,
          primary: { label: 'Decide', command: { kind: 'decide_offer', opportunityId: o.id } },
          secondary: { label: 'Open', command: { kind: 'open_opportunity', opportunityId: o.id } },
        })
      }
    }

    if (o.nextAction) continue // an explicit plan already exists

    const sinceApplied = daysSince(o.dateApplied)
    if (o.stage === 'applied' && sinceApplied !== null && sinceApplied >= settings.applicationFollowUpDays) {
      items.push({
        id: `aw-${o.id}`,
        kind: 'awaiting_response',
        score: 130 + Math.min(sinceApplied, 40) + (PRIORITY_BONUS[o.priority] ?? 0),
        urgency: 'attention',
        title: 'Follow up on this application',
        context: contextFor(o),
        reason: `Applied ${sinceApplied} days ago with no recorded response (your threshold is ${settings.applicationFollowUpDays}d).`,
        dueLabel: `${sinceApplied}d waiting`,
        target: { type: 'opportunity', id: o.id },
        opportunityId: o.id,
        primary: { label: 'Plan action', command: { kind: 'set_next_action', opportunityId: o.id } },
        secondary: { label: 'Open', command: { kind: 'open_opportunity', opportunityId: o.id } },
      })
      continue
    }

    if (o.priority === 'high' && STAGE_META[o.stage].order <= STAGE_META.applied.order) {
      items.push({
        id: `nn-${o.id}`,
        kind: 'no_next_action',
        score: 125,
        urgency: 'attention',
        title: 'Decide the next step',
        context: contextFor(o),
        reason: `Marked ${PRIORITY_META[o.priority].label.toLowerCase()} priority but has no next action.`,
        target: { type: 'opportunity', id: o.id },
        opportunityId: o.id,
        primary: { label: 'Plan action', command: { kind: 'set_next_action', opportunityId: o.id } },
        secondary: { label: 'Open', command: { kind: 'open_opportunity', opportunityId: o.id } },
      })
      continue
    }

    if (o.stage === 'evaluating') {
      const sinceStage = daysSince(o.stageChangedAt)
      if (sinceStage !== null && sinceStage >= 7) {
        items.push({
          id: `ev-${o.id}`,
          kind: 'evaluation_stalled',
          score: 95 + Math.min(sinceStage, 30),
          urgency: 'attention',
          title: 'Apply or drop this one',
          context: contextFor(o),
          reason: `Sitting in Evaluating for ${sinceStage} days without a decision.`,
          target: { type: 'opportunity', id: o.id },
          opportunityId: o.id,
          primary: { label: 'Open', command: { kind: 'open_opportunity', opportunityId: o.id } },
        })
        continue
      }
    }

    const idle = daysSince(o.updatedAt)
    if (idle !== null && idle >= settings.staleOpportunityDays) {
      items.push({
        id: `st-${o.id}`,
        kind: 'stale_opportunity',
        score: 80 + Math.min(idle, 45) + (PRIORITY_BONUS[o.priority] ?? 0),
        urgency: 'attention',
        title: 'Revive or close out this opportunity',
        context: contextFor(o),
        reason: `No activity for ${idle} days while still in ${STAGE_META[o.stage].label}.`,
        dueLabel: `${idle}d idle`,
        target: { type: 'opportunity', id: o.id },
        opportunityId: o.id,
        primary: { label: 'Plan action', command: { kind: 'set_next_action', opportunityId: o.id } },
        secondary: { label: 'Open', command: { kind: 'open_opportunity', opportunityId: o.id } },
      })
    }
  }

  /* ---- Networking ------------------------------------------------------- */
  for (const c of contacts) {
    if (c.archivedAt) continue
    const due = daysFromToday(c.nextFollowUpDate)
    if (due !== null && due <= 0) {
      items.push({
        id: `cf-${c.id}`,
        kind: 'contact_followup',
        score: 165 + Math.min(Math.abs(due), 20) * 2,
        urgency: due < 0 ? 'overdue' : 'today',
        title: `Follow up with ${c.name}`,
        context: [c.title, c.company].filter(Boolean).join(' · ') || 'Contact',
        reason:
          due < 0
            ? `Follow-up was scheduled for ${formatDate(c.nextFollowUpDate)} — ${Math.abs(due)} ${Math.abs(due) === 1 ? 'day' : 'days'} ago.`
            : 'Follow-up is scheduled for today.',
        dueLabel: due < 0 ? `${Math.abs(due)}d overdue` : 'Today',
        target: { type: 'contact', id: c.id },
        opportunityId: c.opportunityIds[0],
        primary: {
          label: 'Draft a note',
          command: { kind: 'draft_contact', contactId: c.id, opportunityId: c.opportunityIds[0] },
        },
        secondary: { label: 'Log outreach', command: { kind: 'log_touch', contactId: c.id } },
      })
      continue
    }

    // A contact attached to a live pursuit that has gone quiet.
    const linkedActive = c.opportunityIds.some((id) => {
      const o = byId.get(id)
      return Boolean(o && !o.archivedAt && STAGE_META[o.stage].active)
    })
    if (!linkedActive) continue
    const quiet = daysSince(c.lastContactDate)
    if (quiet !== null && quiet >= settings.staleContactDays) {
      items.push({
        id: `cs-${c.id}`,
        kind: 'contact_stale',
        score: 90 + Math.min(quiet, 60) / 2,
        urgency: 'attention',
        title: `Reconnect with ${c.name}`,
        context: [c.title, c.company].filter(Boolean).join(' · ') || 'Contact',
        reason: `No contact for ${quiet} days, and they are attached to a live opportunity.`,
        dueLabel: `${quiet}d quiet`,
        target: { type: 'contact', id: c.id },
        opportunityId: c.opportunityIds[0],
        primary: {
          label: 'Draft a note',
          command: { kind: 'draft_contact', contactId: c.id, opportunityId: c.opportunityIds[0] },
        },
        secondary: { label: 'Log outreach', command: { kind: 'log_touch', contactId: c.id } },
      })
    }
  }

  return items.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
}

/**
 * Picks the focused set shown on Today. Caps the number of items drawn from any
 * single opportunity so one noisy record cannot occupy the whole list.
 */
export function selectFocus(items: ActionItem[], limit = 5): ActionItem[] {
  const perOpportunity = new Map<string, number>()
  const chosen: ActionItem[] = []
  for (const item of items) {
    const key = item.opportunityId ?? item.target.id
    const used = perOpportunity.get(key) ?? 0
    if (used >= 2) continue
    perOpportunity.set(key, used + 1)
    chosen.push(item)
    if (chosen.length >= limit) break
  }
  return chosen
}

/* -------------------------------------------------------------------------- */
/*  Upcoming                                                                   */
/* -------------------------------------------------------------------------- */

export interface UpcomingEntry {
  id: string
  date: string
  kind: 'interview' | 'next_action' | 'deadline' | 'follow_up'
  title: string
  context: string
  target: ActionTarget
  opportunityId?: string
  /** Sort key: milliseconds since epoch. */
  ts: number
  timeLabel?: string
}

export function buildUpcoming(
  input: Omit<AgendaInput, 'settings'> & { settings?: WorkspaceSettings },
  windowDays = 14,
): UpcomingEntry[] {
  const { opportunities, contacts, interviews } = input
  const byId = new Map(opportunities.map((o) => [o.id, o]))
  const out: UpcomingEntry[] = []
  const horizon = Date.now() + windowDays * 86_400_000

  for (const iv of interviews) {
    const o = byId.get(iv.opportunityId)
    const when = parseAnyDate(iv.scheduledAt)
    if (!o || !when || o.archivedAt) continue
    if (when.getTime() < Date.now() - 3_600_000 || when.getTime() > horizon) continue
    out.push({
      id: `iv-${iv.id}`,
      date: iv.scheduledAt,
      ts: when.getTime(),
      kind: 'interview',
      title: `${iv.type.replace(/_/g, ' ')} interview`,
      context: `${o.company} · ${o.role}`,
      target: { type: 'interview', id: iv.id },
      opportunityId: o.id,
    })
  }

  for (const o of opportunities) {
    if (o.archivedAt) continue
    if (o.nextAction && o.nextActionDate) {
      const d = parseAnyDate(o.nextActionDate)
      if (d && d.getTime() <= horizon) {
        out.push({
          id: `na-${o.id}`,
          date: o.nextActionDate,
          ts: d.getTime(),
          kind: 'next_action',
          title: o.nextAction,
          context: `${o.company} · ${o.role}`,
          target: { type: 'opportunity', id: o.id },
          opportunityId: o.id,
        })
      }
    }
    if (o.deadline && !o.dateApplied) {
      const d = parseAnyDate(o.deadline)
      if (d && d.getTime() >= Date.now() - 86_400_000 && d.getTime() <= horizon) {
        out.push({
          id: `dl-${o.id}`,
          date: o.deadline,
          ts: d.getTime(),
          kind: 'deadline',
          title: 'Application deadline',
          context: `${o.company} · ${o.role}`,
          target: { type: 'opportunity', id: o.id },
          opportunityId: o.id,
        })
      }
    }
  }

  for (const c of contacts) {
    if (c.archivedAt || !c.nextFollowUpDate) continue
    const d = parseAnyDate(c.nextFollowUpDate)
    if (!d || d.getTime() > horizon) continue
    out.push({
      id: `cf-${c.id}`,
      date: c.nextFollowUpDate,
      ts: d.getTime(),
      kind: 'follow_up',
      title: `Follow up with ${c.name}`,
      context: [c.title, c.company].filter(Boolean).join(' · ') || 'Networking',
      target: { type: 'contact', id: c.id },
      opportunityId: c.opportunityIds[0],
    })
  }

  return out.sort((a, b) => a.ts - b.ts)
}

/** Groups upcoming entries into Today / Tomorrow / This week / Later buckets. */
export function groupUpcoming(entries: UpcomingEntry[]): Array<{ label: string; entries: UpcomingEntry[] }> {
  const buckets: Record<string, UpcomingEntry[]> = { Today: [], Tomorrow: [], 'This week': [], Later: [] }
  for (const e of entries) {
    const d = daysFromToday(e.date)
    const key = d === null ? 'Later' : d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : d <= 7 ? 'This week' : 'Later'
    buckets[key]?.push(e)
  }
  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, entries: list }))
}

export const TODAY_DATE = today
