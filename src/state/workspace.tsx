import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { WorkspaceContext } from './contexts'
import { db, ensureWorkspaceDefaults } from '@/lib/db'
import { computeFit, type FitResult } from '@/lib/fit'
import { buildFitMap } from '@/lib/fit-cache'
import {
  type CustomQuestion,
  DEFAULT_SETTINGS,
  STAGE_META,
  type ActivityEvent,
  type Contact,
  type Interview,
  type MasterProfile,
  type MessageTemplate,
  type Opportunity,
  type SavedView,
  type Story,
  type WorkspaceSettings,
} from '@/lib/types'
import { uniq } from '@/lib/utils'

export interface WorkspaceData {
  opportunities: Opportunity[]
  contacts: Contact[]
  interviews: Interview[]
  stories: Story[]
  events: ActivityEvent[]
  views: SavedView[]
  templates: MessageTemplate[]
  /** Questions the user wrote. */
  questions: CustomQuestion[]
  profile: MasterProfile | null
  settings: WorkspaceSettings
  /** False until the first read from IndexedDB resolves. */
  ready: boolean
  /** Set when IndexedDB itself is unavailable (private mode, disabled storage). */
  storageError: string | null
  /** Fit results, computed once per render pass and shared by every view. */
  fit: Map<string, FitResult>
  byId: Map<string, Opportunity>
  contactsById: Map<string, Contact>
  storiesById: Map<string, Story>
  interviewsById: Map<string, Interview>
  interviewsByOpportunity: Map<string, Interview[]>
  contactsByOpportunity: Map<string, Contact[]>
  eventsByOpportunity: Map<string, ActivityEvent[]>
  allTags: string[]
  allSources: string[]
  isEmpty: boolean
}

export function useWorkspace(): WorkspaceData {
  const ctx = React.useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}

/** Fit result for one opportunity, falling back to a live computation. */
export function useFit(opportunity: Opportunity | null | undefined): FitResult | null {
  const { fit, profile } = useWorkspace()
  return React.useMemo(() => {
    if (!opportunity) return null
    return fit.get(opportunity.id) ?? computeFit(opportunity, profile)
  }, [opportunity, fit, profile])
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [storageError, setStorageError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Best-effort and non-blocking: a missed restore point must never stop the
    // app from starting.
    void import('@/lib/snapshots').then((m) => m.maybeTakeAutomaticSnapshot())
    ensureWorkspaceDefaults().catch((error: unknown) => {
      setStorageError(
        error instanceof Error && /quota/i.test(error.message)
          ? 'This browser has run out of storage space for Opportunity OS.'
          : 'This browser is blocking local storage, so your workspace cannot be saved. Private browsing windows and strict privacy settings are the usual cause.',
      )
    })
  }, [])

  const result = useLiveQuery(async () => {
    const [opportunities, contacts, interviews, stories, events, views, templates, questions, profile, settings] =
      await Promise.all([
        db.opportunities.toArray(),
        db.contacts.toArray(),
        db.interviews.toArray(),
        db.stories.toArray(),
        db.events.orderBy('at').reverse().limit(3000).toArray(),
        db.views.toArray(),
        db.templates.toArray(),
        db.questions.toArray(),
        db.profile.get('master'),
        db.settings.get('workspace'),
      ])
    return {
      opportunities,
      contacts,
      interviews,
      stories,
      events,
      views,
      templates,
      questions,
      profile: profile ?? null,
      settings,
    }
  }, [])

  const value = React.useMemo<WorkspaceData>(() => {
    const opportunities = result?.opportunities ?? []
    const contacts = result?.contacts ?? []
    const interviews = result?.interviews ?? []
    const stories = result?.stories ?? []
    const events = result?.events ?? []
    const views = result?.views ?? []
    const templates = result?.templates ?? []
    const questions = result?.questions ?? []
    const profile = result?.profile ?? null
    const settings = result?.settings ?? { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() }

    const fit = buildFitMap(opportunities, profile)

    const byId = new Map(opportunities.map((o) => [o.id, o]))
    const contactsById = new Map(contacts.map((c) => [c.id, c]))
    const storiesById = new Map(stories.map((s) => [s.id, s]))
    const interviewsById = new Map(interviews.map((i) => [i.id, i]))

    const interviewsByOpportunity = new Map<string, Interview[]>()
    for (const iv of interviews) {
      const list = interviewsByOpportunity.get(iv.opportunityId) ?? []
      list.push(iv)
      interviewsByOpportunity.set(iv.opportunityId, list)
    }
    for (const list of interviewsByOpportunity.values()) {
      list.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    }

    const contactsByOpportunity = new Map<string, Contact[]>()
    for (const c of contacts) {
      for (const oid of c.opportunityIds) {
        const list = contactsByOpportunity.get(oid) ?? []
        list.push(c)
        contactsByOpportunity.set(oid, list)
      }
    }

    const eventsByOpportunity = new Map<string, ActivityEvent[]>()
    for (const e of events) {
      if (!e.opportunityId) continue
      const list = eventsByOpportunity.get(e.opportunityId) ?? []
      list.push(e)
      eventsByOpportunity.set(e.opportunityId, list)
    }

    return {
      opportunities,
      contacts,
      interviews,
      stories,
      events,
      views,
      templates,
      questions,
      profile,
      settings,
      ready: result !== undefined,
      storageError,
      fit,
      byId,
      contactsById,
      storiesById,
      interviewsById,
      interviewsByOpportunity,
      contactsByOpportunity,
      eventsByOpportunity,
      allTags: uniq([...opportunities.flatMap((o) => o.tags), ...contacts.flatMap((c) => c.tags)]).sort(),
      allSources: uniq(opportunities.map((o) => o.source).filter((s): s is string => Boolean(s))).sort(),
      isEmpty:
        result !== undefined &&
        opportunities.length === 0 &&
        contacts.length === 0 &&
        interviews.length === 0 &&
        stories.length === 0,
    }
  }, [result, storageError])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

/** Active, non-archived opportunities in board order. */
export function activeOpportunities(opportunities: Opportunity[]): Opportunity[] {
  return opportunities
    .filter((o) => !o.archivedAt && STAGE_META[o.stage].active)
    .sort((a, b) => STAGE_META[a.stage].order - STAGE_META[b.stage].order)
}
