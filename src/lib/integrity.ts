/**
 * Workspace integrity.
 *
 * Records reference each other by id, and ids can go stale: a hand-edited
 * backup, an interrupted delete, a merge that dropped a parent. Nothing here
 * guesses — it reports exactly what it found and, where the repair is
 * unambiguous (drop a reference to something that no longer exists), offers to
 * apply it.
 */
import { db } from './db'
import { roleSimilarity } from './duplicates'
import {
  STAGE_META,
  type ActivityEvent,
  type Contact,
  type Interview,
  type Opportunity,
  type DecisionCriterion,
  type SavedView,
  type Story,
} from './types'
import { normalize } from './utils'

export type IssueSeverity = 'broken' | 'inconsistent' | 'notice'

export interface IntegrityIssue {
  id: string
  severity: IssueSeverity
  title: string
  detail: string
  /** How many records are affected. */
  count: number
  /** Present when the repair is unambiguous and safe. */
  repair?: () => Promise<void>
  repairLabel?: string
}

export interface IntegrityReport {
  issues: IntegrityIssue[]
  checkedAt: string
  /** Totals scanned, so a clean result can say what it looked at. */
  scanned: Record<string, number>
}

interface Workspace {
  opportunities: Opportunity[]
  contacts: Contact[]
  interviews: Interview[]
  stories: Story[]
  events: ActivityEvent[]
  views: SavedView[]
  /** The criteria in force, so ratings against deleted ones can be spotted. */
  criteria: DecisionCriterion[]
}

export async function loadForIntegrityCheck(): Promise<Workspace> {
  const [opportunities, contacts, interviews, stories, events, views, settings] = await Promise.all([
    db.opportunities.toArray(),
    db.contacts.toArray(),
    db.interviews.toArray(),
    db.stories.toArray(),
    db.events.toArray(),
    db.views.toArray(),
    db.settings.get('workspace'),
  ])
  return {
    opportunities,
    contacts,
    interviews,
    stories,
    events,
    views,
    criteria: settings?.decisionCriteria ?? [],
  }
}

export function checkIntegrity(workspace: Workspace): IntegrityReport {
  const { opportunities, contacts, interviews, stories, events, criteria } = workspace
  const opportunityIds = new Set(opportunities.map((o) => o.id))
  const contactIds = new Set(contacts.map((c) => c.id))
  const storyIds = new Set(stories.map((s) => s.id))
  const interviewIds = new Set(interviews.map((i) => i.id))

  const issues: IntegrityIssue[] = []

  /* -- ratings left behind by a deleted criterion -- */
  // Harmless on its own, but it accumulates every time the criteria list is
  // edited, and it silently bloats every export from then on.
  const criterionIds = new Set(criteria.map((c) => c.id))
  const strandedRatings = opportunities.filter((o) =>
    Object.keys(o.decisionRatings ?? {}).some((id) => !criterionIds.has(id)),
  )
  if (criteria.length > 0 && strandedRatings.length > 0) {
    issues.push({
      id: 'stranded-ratings',
      severity: 'notice',
      title: 'Ratings against criteria you have since deleted',
      detail: `${strandedRatings.length} ${strandedRatings.length === 1 ? 'record keeps' : 'records keep'} a judgement against something no longer on your list. Nothing reads them; clearing them keeps exports tidy.`,
      count: strandedRatings.length,
      repairLabel: 'Clear them',
      repair: async () => {
        await Promise.all(
          strandedRatings.map((o) => {
            const kept = Object.fromEntries(
              Object.entries(o.decisionRatings ?? {}).filter(([id]) => criterionIds.has(id)),
            )
            return db.opportunities.put({
              ...o,
              decisionRatings: Object.keys(kept).length > 0 ? kept : undefined,
            })
          }),
        )
      },
    })
  }

  /* -- interviews attached to a missing opportunity -- */
  const orphanInterviews = interviews.filter((i) => !opportunityIds.has(i.opportunityId))
  if (orphanInterviews.length > 0) {
    issues.push({
      id: 'orphan-interviews',
      severity: 'broken',
      title: `${orphanInterviews.length} interview${orphanInterviews.length === 1 ? '' : 's'} without an opportunity`,
      detail:
        'These interviews point at an opportunity that is no longer in the workspace, so they cannot be opened or counted.',
      count: orphanInterviews.length,
      repairLabel: 'Delete them',
      repair: async () => {
        await db.interviews.bulkDelete(orphanInterviews.map((i) => i.id))
      },
    })
  }

  /* -- contacts linked to a missing opportunity -- */
  const contactsWithDeadLinks = contacts.filter((c) => c.opportunityIds.some((id) => !opportunityIds.has(id)))
  if (contactsWithDeadLinks.length > 0) {
    issues.push({
      id: 'contact-links',
      severity: 'broken',
      title: `${contactsWithDeadLinks.length} contact${contactsWithDeadLinks.length === 1 ? '' : 's'} linked to a missing opportunity`,
      detail: 'The contacts themselves are fine; only the link is stale.',
      count: contactsWithDeadLinks.length,
      repairLabel: 'Remove the stale links',
      repair: async () => {
        await db.contacts.bulkPut(
          contactsWithDeadLinks.map((c) => ({
            ...c,
            opportunityIds: c.opportunityIds.filter((id) => opportunityIds.has(id)),
          })),
        )
      },
    })
  }

  /* -- interviews referencing missing people or stories -- */
  const interviewsWithDeadRefs = interviews.filter(
    (i) => i.contactIds.some((id) => !contactIds.has(id)) || i.storyIds.some((id) => !storyIds.has(id)),
  )
  if (interviewsWithDeadRefs.length > 0) {
    issues.push({
      id: 'interview-refs',
      severity: 'broken',
      title: `${interviewsWithDeadRefs.length} interview${interviewsWithDeadRefs.length === 1 ? '' : 's'} referencing a deleted contact or story`,
      detail: 'The interview is intact; the missing references are simply dropped.',
      count: interviewsWithDeadRefs.length,
      repairLabel: 'Drop the references',
      repair: async () => {
        await db.interviews.bulkPut(
          interviewsWithDeadRefs.map((i) => ({
            ...i,
            contactIds: i.contactIds.filter((id) => contactIds.has(id)),
            storyIds: i.storyIds.filter((id) => storyIds.has(id)),
          })),
        )
      },
    })
  }

  /* -- activity entries pointing nowhere -- */
  const orphanEvents = events.filter(
    (e) =>
      (e.opportunityId && !opportunityIds.has(e.opportunityId)) ||
      (e.contactId && !contactIds.has(e.contactId)) ||
      (e.interviewId && !interviewIds.has(e.interviewId)),
  )
  if (orphanEvents.length > 0) {
    issues.push({
      id: 'orphan-events',
      severity: 'broken',
      title: `${orphanEvents.length} activity ${orphanEvents.length === 1 ? 'entry' : 'entries'} for deleted records`,
      detail: 'History for records that no longer exist. Harmless, but it inflates the workspace.',
      count: orphanEvents.length,
      repairLabel: 'Clear them',
      repair: async () => {
        await db.events.bulkDelete(orphanEvents.map((e) => e.id))
      },
    })
  }

  /* -- inconsistent application state -- */
  const appliedWithoutStage = opportunities.filter(
    (o) => o.dateApplied && STAGE_META[o.stage].order < STAGE_META.applied.order,
  )
  if (appliedWithoutStage.length > 0) {
    issues.push({
      id: 'applied-stage',
      severity: 'inconsistent',
      title: `${appliedWithoutStage.length} ${appliedWithoutStage.length === 1 ? 'opportunity has' : 'opportunities have'} an application date but an earlier stage`,
      detail:
        'The funnel counts an application from the stage history, so these are excluded from your response rate. Moving them to Applied fixes that.',
      count: appliedWithoutStage.length,
      repairLabel: 'Move them to Applied',
      repair: async () => {
        const at = new Date().toISOString()
        await db.opportunities.bulkPut(
          appliedWithoutStage.map((o) => ({
            ...o,
            stage: 'applied' as const,
            stageChangedAt: at,
            updatedAt: at,
            stageHistory: [...(o.stageHistory ?? []), { stage: 'applied' as const, at }],
          })),
        )
      },
    })
  }

  const closedWithoutOutcome = opportunities.filter((o) => o.stage === 'rejected' && !o.rejection?.date)
  if (closedWithoutOutcome.length > 0) {
    issues.push({
      id: 'rejection-detail',
      severity: 'notice',
      title: `${closedWithoutOutcome.length} rejected ${closedWithoutOutcome.length === 1 ? 'opportunity has' : 'opportunities have'} no recorded outcome`,
      detail:
        'Adding the date and the reason makes time-to-outcome and the reason breakdown meaningful. Nothing is broken.',
      count: closedWithoutOutcome.length,
    })
  }

  /* -- probable duplicates -- */
  const duplicatePairs: string[] = []
  for (let i = 0; i < opportunities.length; i++) {
    for (let j = i + 1; j < opportunities.length; j++) {
      const a = opportunities[i]
      const b = opportunities[j]
      if (!a || !b) continue
      const sameCompany = normalize(a.company).replace(/[^a-z0-9]/g, '') === normalize(b.company).replace(/[^a-z0-9]/g, '')
      if (sameCompany && roleSimilarity(a.role, b.role) >= 0.8) {
        duplicatePairs.push(`${a.company} · ${a.role}`)
      }
    }
  }
  if (duplicatePairs.length > 0) {
    issues.push({
      id: 'duplicates',
      severity: 'notice',
      title: `${duplicatePairs.length} possible duplicate ${duplicatePairs.length === 1 ? 'opportunity' : 'opportunities'}`,
      detail: `Same company and a near-identical title: ${duplicatePairs.slice(0, 3).join('; ')}${duplicatePairs.length > 3 ? '…' : ''}. Merging is a judgement call, so nothing is changed automatically.`,
      count: duplicatePairs.length,
    })
  }

  return {
    issues,
    checkedAt: new Date().toISOString(),
    scanned: {
      opportunities: opportunities.length,
      contacts: contacts.length,
      interviews: interviews.length,
      stories: stories.length,
      activity: events.length,
    },
  }
}
