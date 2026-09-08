import { db, createDefaultProfile } from './db'
import {
  DEFAULT_SETTINGS,
  STAGE_META,
  type ActivityEvent,
  type Contact,
  type EventType,
  type ID,
  type Interview,
  type InterviewType,
  type MasterProfile,
  type MessageTemplate,
  type Opportunity,
  type Priority,
  type SavedView,
  type Stage,
  INTERVIEW_TYPES,
  type CustomQuestion,
  type DecisionCriterion,
  type DecisionRating,
  type InterviewOutcome,
  type RehearsalRating,
  type Story,
  type WorkspaceSettings,
} from './types'
import { newId, nowIso, today, uniq } from './utils'
import { appendRun } from './rehearsal'

/* -------------------------------------------------------------------------- */
/*  Activity log                                                               */
/* -------------------------------------------------------------------------- */

export async function logEvent(
  event: Omit<ActivityEvent, 'id' | 'at'> & { at?: string },
): Promise<ActivityEvent> {
  const record: ActivityEvent = { id: newId('ev_'), at: event.at ?? nowIso(), ...event }
  await db.events.add(record)
  return record
}

/**
 * An undoable mutation. `undo` restores the exact prior records, so it is safe
 * to expose behind a toast without leaving the workspace half-changed.
 */
export interface Undoable {
  undo: () => Promise<void>
}

/* -------------------------------------------------------------------------- */
/*  Opportunities                                                              */
/* -------------------------------------------------------------------------- */

export type NewOpportunity = Partial<Opportunity> &
  Pick<Opportunity, 'company' | 'role'>

export function draftOpportunity(input: NewOpportunity): Opportunity {
  const ts = nowIso()
  return {
    id: input.id ?? newId('op_'),
    company: input.company.trim(),
    role: input.role.trim(),
    jobUrl: input.jobUrl,
    location: input.location,
    workArrangement: input.workArrangement ?? 'unknown',
    salaryMin: input.salaryMin,
    salaryMax: input.salaryMax,
    currency: input.currency ?? 'USD',
    source: input.source,
    dateDiscovered: input.dateDiscovered ?? today(),
    dateApplied: input.dateApplied,
    deadline: input.deadline,
    stage: input.stage ?? 'saved',
    priority: input.priority ?? 'medium',
    interestScore: input.interestScore,
    companyScore: input.companyScore,
    roleScore: input.roleScore,
    jobDescription: input.jobDescription,
    whyInterested: input.whyInterested,
    strengths: input.strengths,
    concerns: input.concerns,
    notes: input.notes,
    tags: uniq(input.tags ?? []),
    nextAction: input.nextAction,
    nextActionDate: input.nextActionDate,
    rejection: input.rejection,
    offer: input.offer,
    archivedAt: input.archivedAt,
    createdAt: input.createdAt ?? ts,
    updatedAt: input.updatedAt ?? ts,
    stageChangedAt: input.stageChangedAt ?? ts,
    stageHistory: input.stageHistory ?? [{ stage: input.stage ?? 'saved', at: input.createdAt ?? ts }],
  }
}

export async function createOpportunity(input: NewOpportunity): Promise<Opportunity> {
  const record = draftOpportunity(input)
  await db.opportunities.add(record)
  await logEvent({
    type: 'opportunity_created',
    opportunityId: record.id,
    summary: `Added ${record.role} at ${record.company}`,
    detail: record.source ? `Source: ${record.source}` : undefined,
  })
  if (record.stage !== 'saved') {
    await logEvent({
      type: 'stage_changed',
      opportunityId: record.id,
      summary: `Stage set to ${STAGE_META[record.stage].label}`,
    })
  }
  return record
}

/**
 * Applies a patch and writes precise timeline entries for the changes that
 * matter. Side effects (setting `dateApplied`, stamping `stageChangedAt`) live
 * here so every caller — table, board, detail panel, command palette — behaves
 * identically.
 */
export async function updateOpportunity(
  id: ID,
  patch: Partial<Opportunity>,
  options: { silent?: boolean } = {},
): Promise<Opportunity | null> {
  const before = await db.opportunities.get(id)
  if (!before) return null

  const next: Opportunity = { ...before, ...patch, updatedAt: nowIso() }

  const stageChanged = patch.stage !== undefined && patch.stage !== before.stage
  if (stageChanged) {
    const at = nowIso()
    next.stageChangedAt = at
    next.stageHistory = [...(before.stageHistory ?? []), { stage: next.stage, at }]
    const reachedApplied = STAGE_META[next.stage].order >= STAGE_META.applied.order
    if (reachedApplied && next.stage !== 'withdrawn' && !next.dateApplied) {
      next.dateApplied = today()
    }
  }

  await db.opportunities.put(next)
  if (options.silent) return next

  const events: Array<Omit<ActivityEvent, 'id' | 'at'>> = []
  if (stageChanged) {
    events.push({
      type: next.stage === 'rejected' ? 'rejected' : next.stage === 'withdrawn' ? 'withdrawn' : 'stage_changed',
      opportunityId: id,
      summary: `${STAGE_META[before.stage].label} → ${STAGE_META[next.stage].label}`,
    })
    if (!before.dateApplied && next.dateApplied) {
      events.push({ type: 'applied', opportunityId: id, summary: `Applied to ${next.company}` })
    }
  }
  if (patch.priority !== undefined && patch.priority !== before.priority) {
    events.push({
      type: 'priority_changed',
      opportunityId: id,
      summary: `Priority ${before.priority} → ${next.priority}`,
    })
  }
  if (
    (patch.nextAction !== undefined || patch.nextActionDate !== undefined) &&
    (patch.nextAction !== before.nextAction || patch.nextActionDate !== before.nextActionDate) &&
    next.nextAction
  ) {
    events.push({
      type: 'next_action_set',
      opportunityId: id,
      summary: `Next action: ${next.nextAction}`,
      detail: next.nextActionDate ? `Due ${next.nextActionDate}` : undefined,
    })
  }
  if (patch.offer !== undefined && !before.offer && next.offer) {
    events.push({ type: 'offer_recorded', opportunityId: id, summary: `Offer recorded` })
  }
  for (const e of events) await logEvent(e)
  return next
}

export async function completeNextAction(id: ID, note?: string): Promise<Undoable | null> {
  const before = await db.opportunities.get(id)
  if (!before || !before.nextAction) return null
  await db.opportunities.put({
    ...before,
    nextAction: undefined,
    nextActionDate: undefined,
    updatedAt: nowIso(),
  })
  const event = await logEvent({
    type: 'next_action_completed',
    opportunityId: id,
    summary: `Completed: ${before.nextAction}`,
    detail: note,
  })
  return {
    undo: async () => {
      await db.opportunities.put(before)
      await db.events.delete(event.id)
    },
  }
}

export async function setNextAction(
  id: ID,
  action: string,
  date: string | undefined,
): Promise<void> {
  await updateOpportunity(id, { nextAction: action.trim() || undefined, nextActionDate: date })
}

export async function archiveOpportunities(ids: ID[], archived = true): Promise<Undoable> {
  const before = await db.opportunities.bulkGet(ids)
  const present = before.filter((o): o is Opportunity => Boolean(o))
  const stamp = nowIso()
  await db.opportunities.bulkPut(
    present.map((o) => ({ ...o, archivedAt: archived ? stamp : undefined, updatedAt: stamp })),
  )
  const eventIds: string[] = []
  for (const o of present) {
    const ev = await logEvent({
      type: archived ? 'archived' : 'unarchived',
      opportunityId: o.id,
      summary: archived ? 'Archived' : 'Restored from archive',
    })
    eventIds.push(ev.id)
  }
  return {
    undo: async () => {
      await db.opportunities.bulkPut(present)
      await db.events.bulkDelete(eventIds)
    },
  }
}

export async function bulkSetStage(ids: ID[], stage: Stage): Promise<Undoable> {
  const before = (await db.opportunities.bulkGet(ids)).filter((o): o is Opportunity => Boolean(o))
  const eventIds: string[] = []
  for (const o of before) {
    if (o.stage === stage) continue
    await updateOpportunity(o.id, { stage })
    const latest = await db.events.orderBy('at').last()
    if (latest) eventIds.push(latest.id)
  }
  return {
    undo: async () => {
      await db.opportunities.bulkPut(before)
      await db.events.bulkDelete(eventIds)
    },
  }
}

export async function bulkSetPriority(ids: ID[], priority: Priority): Promise<Undoable> {
  const before = (await db.opportunities.bulkGet(ids)).filter((o): o is Opportunity => Boolean(o))
  await db.opportunities.bulkPut(before.map((o) => ({ ...o, priority, updatedAt: nowIso() })))
  return { undo: async () => void (await db.opportunities.bulkPut(before)) }
}

export async function addTagsTo(ids: ID[], tags: string[]): Promise<Undoable> {
  const before = (await db.opportunities.bulkGet(ids)).filter((o): o is Opportunity => Boolean(o))
  await db.opportunities.bulkPut(
    before.map((o) => ({ ...o, tags: uniq([...o.tags, ...tags]), updatedAt: nowIso() })),
  )
  return { undo: async () => void (await db.opportunities.bulkPut(before)) }
}

/** Hard delete, cascading interviews, contact links and timeline entries. */
export async function deleteOpportunities(ids: ID[]): Promise<Undoable> {
  const set = new Set(ids)
  const [opps, interviews, contacts, events] = await Promise.all([
    db.opportunities.bulkGet(ids).then((r) => r.filter((o): o is Opportunity => Boolean(o))),
    db.interviews.where('opportunityId').anyOf(ids).toArray(),
    db.contacts.filter((c) => c.opportunityIds.some((oid) => set.has(oid))).toArray(),
    db.events.filter((e) => Boolean(e.opportunityId && set.has(e.opportunityId))).toArray(),
  ])

  await db.transaction('rw', [db.opportunities, db.interviews, db.contacts, db.events], async () => {
    await db.opportunities.bulkDelete(ids)
    await db.interviews.bulkDelete(interviews.map((i) => i.id))
    await db.events.bulkDelete(events.map((e) => e.id))
    await db.contacts.bulkPut(
      contacts.map((c) => ({
        ...c,
        opportunityIds: c.opportunityIds.filter((oid) => !set.has(oid)),
        updatedAt: nowIso(),
      })),
    )
  })

  return {
    undo: async () => {
      await db.transaction(
        'rw',
        [db.opportunities, db.interviews, db.contacts, db.events],
        async () => {
          await db.opportunities.bulkPut(opps)
          await db.interviews.bulkPut(interviews)
          await db.events.bulkPut(events)
          await db.contacts.bulkPut(contacts)
        },
      )
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Contacts                                                                   */
/* -------------------------------------------------------------------------- */

export type NewContact = Partial<Contact> & Pick<Contact, 'name'>

export function draftContact(input: NewContact): Contact {
  const ts = nowIso()
  return {
    id: input.id ?? newId('ct_'),
    name: input.name.trim(),
    company: input.company,
    title: input.title,
    linkedinUrl: input.linkedinUrl,
    email: input.email,
    phone: input.phone,
    relationship: input.relationship ?? 'other',
    opportunityIds: uniq(input.opportunityIds ?? []),
    lastContactDate: input.lastContactDate,
    nextFollowUpDate: input.nextFollowUpDate,
    notes: input.notes,
    tags: uniq(input.tags ?? []),
    archivedAt: input.archivedAt,
    createdAt: input.createdAt ?? ts,
    updatedAt: input.updatedAt ?? ts,
  }
}

export async function createContact(input: NewContact): Promise<Contact> {
  const record = draftContact(input)
  await db.contacts.add(record)
  await logEvent({
    type: 'contact_linked',
    contactId: record.id,
    opportunityId: record.opportunityIds[0],
    summary: `Added contact ${record.name}${record.company ? ` (${record.company})` : ''}`,
  })
  return record
}

export async function updateContact(id: ID, patch: Partial<Contact>): Promise<Contact | null> {
  const before = await db.contacts.get(id)
  if (!before) return null
  const next = { ...before, ...patch, updatedAt: nowIso() }
  await db.contacts.put(next)
  const linked = (patch.opportunityIds ?? []).filter((x) => !before.opportunityIds.includes(x))
  for (const oid of linked) {
    await logEvent({
      type: 'contact_linked',
      contactId: id,
      opportunityId: oid,
      summary: `Linked ${next.name} to this opportunity`,
    })
  }
  return next
}

/** Records a networking touch: stamps last contact and schedules the next one. */
export async function logContactTouch(
  id: ID,
  options: { date?: string; note?: string; nextFollowUpDate?: string } = {},
): Promise<Undoable | null> {
  const before = await db.contacts.get(id)
  if (!before) return null
  const date = options.date ?? today()
  await db.contacts.put({
    ...before,
    lastContactDate: date,
    nextFollowUpDate: options.nextFollowUpDate,
    updatedAt: nowIso(),
  })
  const ev = await logEvent({
    type: 'contact_logged',
    contactId: id,
    opportunityId: before.opportunityIds[0],
    summary: `Reached out to ${before.name}`,
    detail: options.note,
  })
  return {
    undo: async () => {
      await db.contacts.put(before)
      await db.events.delete(ev.id)
    },
  }
}

export async function deleteContacts(ids: ID[]): Promise<Undoable> {
  const set = new Set(ids)
  const [contacts, interviews, events] = await Promise.all([
    db.contacts.bulkGet(ids).then((r) => r.filter((c): c is Contact => Boolean(c))),
    db.interviews.filter((i) => i.contactIds.some((cid) => set.has(cid))).toArray(),
    db.events.filter((e) => Boolean(e.contactId && set.has(e.contactId))).toArray(),
  ])
  await db.transaction('rw', [db.contacts, db.interviews, db.events], async () => {
    await db.contacts.bulkDelete(ids)
    await db.events.bulkDelete(events.map((e) => e.id))
    await db.interviews.bulkPut(
      interviews.map((i) => ({
        ...i,
        contactIds: i.contactIds.filter((cid) => !set.has(cid)),
        updatedAt: nowIso(),
      })),
    )
  })
  return {
    undo: async () => {
      await db.transaction('rw', [db.contacts, db.interviews, db.events], async () => {
        await db.contacts.bulkPut(contacts)
        await db.interviews.bulkPut(interviews)
        await db.events.bulkPut(events)
      })
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Interviews                                                                 */
/* -------------------------------------------------------------------------- */

export type NewInterview = Partial<Interview> & Pick<Interview, 'opportunityId' | 'scheduledAt'>

export const DEFAULT_CHECKLIST = [
  'Re-read the job description',
  'Research the interviewer',
  'Prepare 3 relevant stories',
  'Prepare questions to ask',
  'Confirm logistics and time zone',
]

export function draftInterview(input: NewInterview): Interview {
  const ts = nowIso()
  return {
    id: input.id ?? newId('iv_'),
    opportunityId: input.opportunityId,
    scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes ?? 45,
    type: input.type ?? 'recruiter',
    format: input.format ?? 'video',
    contactIds: uniq(input.contactIds ?? []),
    interviewers: input.interviewers,
    prepNotes: input.prepNotes,
    questionsExpected: input.questionsExpected ?? [],
    questionsToAsk: input.questionsToAsk ?? [],
    checklist:
      input.checklist ?? DEFAULT_CHECKLIST.map((text) => ({ id: newId('ck_'), text, done: false })),
    storyIds: input.storyIds ?? [],
    outcome: input.outcome ?? 'pending',
    debrief: input.debrief,
    debriefedAt: input.debriefedAt,
    askedQuestions: input.askedQuestions,
    debriefRead: input.debriefRead,
    outcomeAskedAt: input.outcomeAskedAt,
    followUpSent: input.followUpSent ?? false,
    followUpDueDate: input.followUpDueDate,
    createdAt: input.createdAt ?? ts,
    updatedAt: input.updatedAt ?? ts,
  }
}

export async function createInterview(input: NewInterview): Promise<Interview> {
  const record = draftInterview(input)
  await db.interviews.add(record)
  const opp = await db.opportunities.get(record.opportunityId)
  await logEvent({
    type: 'interview_created',
    opportunityId: record.opportunityId,
    interviewId: record.id,
    summary: `Scheduled ${labelForInterviewType(record.type)} interview${opp ? ` with ${opp.company}` : ''}`,
  })
  return record
}

function labelForInterviewType(type: InterviewType): string {
  return type.replace(/_/g, ' ')
}

/**
 * Records a debrief. Undoable as one unit, because it is written from memory in
 * a hurry and getting a verdict wrong should cost one keystroke to fix.
 */
export async function saveDebrief(
  id: ID,
  patch: Pick<Interview, 'askedQuestions' | 'debriefRead' | 'debrief' | 'outcome'>,
): Promise<Undoable> {
  const before = await db.interviews.get(id)
  if (!before) return { undo: async () => {} }
  const first = !before.debriefedAt
  await db.interviews.put({ ...before, ...patch, debriefedAt: nowIso(), updatedAt: nowIso() })
  if (patch.outcome && patch.outcome !== before.outcome && patch.outcome !== 'pending') {
    await logEvent({
      type: 'interview_result',
      opportunityId: before.opportunityId,
      interviewId: id,
      summary: `Interview outcome: ${patch.outcome.replace(/_/g, ' ')}`,
    })
  }
  if (first) {
    await logEvent({
      type: 'interview_result',
      opportunityId: before.opportunityId,
      interviewId: id,
      summary: `Debriefed the ${before.type.replace(/_/g, ' ')} interview`,
    })
  }
  return {
    undo: async () => {
      await db.interviews.put(before)
    },
  }
}

/**
 * Records what came of an interview, or notes that you still do not know.
 *
 * Undoable together, because this is answered in one keystroke from Today and
 * the wrong button is easy to hit.
 */
export async function recordOutcome(
  id: ID,
  outcome: InterviewOutcome | 'waiting',
): Promise<Undoable> {
  const before = await db.interviews.get(id)
  if (!before) return { undo: async () => {} }
  const next: Interview =
    outcome === 'waiting'
      ? { ...before, outcomeAskedAt: nowIso(), updatedAt: nowIso() }
      : { ...before, outcome, outcomeAskedAt: nowIso(), updatedAt: nowIso() }
  await db.interviews.put(next)
  if (outcome !== 'waiting' && outcome !== before.outcome && outcome !== 'pending') {
    await logEvent({
      type: 'interview_result',
      opportunityId: before.opportunityId,
      interviewId: id,
      summary: `Interview outcome: ${outcome.replace(/_/g, ' ')}`,
    })
  }
  return {
    undo: async () => {
      await db.interviews.put(before)
    },
  }
}

export async function updateInterview(id: ID, patch: Partial<Interview>): Promise<Interview | null> {
  const before = await db.interviews.get(id)
  if (!before) return null
  const next = { ...before, ...patch, updatedAt: nowIso() }
  await db.interviews.put(next)
  if (patch.outcome && patch.outcome !== before.outcome && patch.outcome !== 'pending') {
    await logEvent({
      type: 'interview_result',
      opportunityId: next.opportunityId,
      interviewId: id,
      summary: `Interview outcome: ${patch.outcome.replace(/_/g, ' ')}`,
    })
  }
  if (patch.followUpSent && !before.followUpSent) {
    await logEvent({
      type: 'follow_up_completed',
      opportunityId: next.opportunityId,
      interviewId: id,
      summary: 'Interview follow-up sent',
    })
  }
  return next
}

export async function deleteInterviews(ids: ID[]): Promise<Undoable> {
  const set = new Set(ids)
  const [interviews, events] = await Promise.all([
    db.interviews.bulkGet(ids).then((r) => r.filter((i): i is Interview => Boolean(i))),
    db.events.filter((e) => Boolean(e.interviewId && set.has(e.interviewId))).toArray(),
  ])
  await db.transaction('rw', [db.interviews, db.events], async () => {
    await db.interviews.bulkDelete(ids)
    await db.events.bulkDelete(events.map((e) => e.id))
  })
  return {
    undo: async () => {
      await db.transaction('rw', [db.interviews, db.events], async () => {
        await db.interviews.bulkPut(interviews)
        await db.events.bulkPut(events)
      })
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Stories                                                                    */
/* -------------------------------------------------------------------------- */

export type NewStory = Partial<Story> & Pick<Story, 'title'>

export function draftStory(input: NewStory): Story {
  const ts = nowIso()
  return {
    id: input.id ?? newId('st_'),
    title: input.title.trim(),
    situation: input.situation,
    task: input.task,
    action: input.action,
    result: input.result,
    metrics: input.metrics,
    skills: uniq(input.skills ?? []),
    tags: uniq(input.tags ?? []),
    favorite: input.favorite ?? false,
    lastUsedAt: input.lastUsedAt,
    useCount: input.useCount ?? 0,
    rehearsalCount: input.rehearsalCount ?? 0,
    lastRehearsedAt: input.lastRehearsedAt,
    lastRehearsalRating: input.lastRehearsalRating,
    recentRuns: input.recentRuns,
    createdAt: input.createdAt ?? ts,
    updatedAt: input.updatedAt ?? ts,
  }
}

export async function createStory(input: NewStory): Promise<Story> {
  const record = draftStory(input)
  await db.stories.add(record)
  return record
}

export async function updateStory(id: ID, patch: Partial<Story>): Promise<Story | null> {
  const before = await db.stories.get(id)
  if (!before) return null
  const next = { ...before, ...patch, updatedAt: nowIso() }
  await db.stories.put(next)
  return next
}

export async function markStoryUsed(id: ID): Promise<void> {
  const before = await db.stories.get(id)
  if (!before) return
  await db.stories.put({
    ...before,
    lastUsedAt: nowIso(),
    useCount: before.useCount + 1,
    updatedAt: nowIso(),
  })
}

/**
 * Logs one rehearsal. Undoable, because the rating is a judgement made in the
 * two seconds after speaking and people change their minds about it.
 */
export async function recordRehearsal(
  id: ID,
  rating: RehearsalRating,
  seconds?: number,
): Promise<Undoable> {
  const before = await db.stories.get(id)
  if (!before) return { undo: async () => {} }
  const at = nowIso()
  await db.stories.put({
    ...before,
    rehearsalCount: (before.rehearsalCount ?? 0) + 1,
    lastRehearsedAt: at,
    lastRehearsalRating: rating,
    // A run of zero seconds means the clock never started; that is not a run.
    recentRuns:
      seconds && seconds > 0 ? appendRun(before, { at, seconds, rating }) : before.recentRuns,
    updatedAt: at,
  })
  return {
    undo: async () => {
      await db.stories.put(before)
    },
  }
}

export async function deleteStories(ids: ID[]): Promise<Undoable> {
  const set = new Set(ids)
  const [stories, interviews] = await Promise.all([
    db.stories.bulkGet(ids).then((r) => r.filter((s): s is Story => Boolean(s))),
    db.interviews.filter((i) => i.storyIds.some((sid) => set.has(sid))).toArray(),
  ])
  await db.transaction('rw', [db.stories, db.interviews], async () => {
    await db.stories.bulkDelete(ids)
    await db.interviews.bulkPut(
      interviews.map((i) => ({ ...i, storyIds: i.storyIds.filter((sid) => !set.has(sid)) })),
    )
  })
  return {
    undo: async () => {
      await db.transaction('rw', [db.stories, db.interviews], async () => {
        await db.stories.bulkPut(stories)
        await db.interviews.bulkPut(interviews)
      })
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Profile, settings, saved views                                             */
/* -------------------------------------------------------------------------- */

export async function updateProfile(patch: Partial<MasterProfile>): Promise<MasterProfile> {
  const before = (await db.profile.get('master')) ?? createDefaultProfile()
  const next: MasterProfile = { ...before, ...patch, id: 'master', updatedAt: nowIso() }
  await db.profile.put(next)
  return next
}

export async function updateSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
  const before = (await db.settings.get('workspace')) ?? { ...DEFAULT_SETTINGS, updatedAt: nowIso() }
  const next: WorkspaceSettings = { ...before, ...patch, id: 'workspace', updatedAt: nowIso() }
  await db.settings.put(next)
  return next
}

export async function saveView(
  view: Omit<SavedView, 'id' | 'createdAt'> & Partial<Pick<SavedView, 'id'>>,
): Promise<SavedView> {
  const existing = view.id ? await db.views.get(view.id) : undefined
  const record: SavedView = {
    id: view.id ?? newId('vw_'),
    name: view.name,
    pinned: view.pinned ?? existing?.pinned ?? false,
    filters: view.filters,
    sortBy: view.sortBy,
    sortDir: view.sortDir,
    columns: view.columns,
    createdAt: existing?.createdAt ?? nowIso(),
  }
  await db.views.put(record)
  return record
}

/** Pins or unpins a saved view in the sidebar. */
export async function toggleViewPinned(id: ID): Promise<void> {
  const view = await db.views.get(id)
  if (!view) return
  await db.views.put({ ...view, pinned: !view.pinned })
}

export async function deleteView(id: ID): Promise<{ undo: () => Promise<void> }> {
  // A view is a filter set, a sort and a column layout someone assembled on
  // purpose, and it is deleted from a menu in one click, so it is put back
  // whole rather than rebuilt from memory.
  const existing = await db.views.get(id)
  await db.views.delete(id)
  return {
    undo: async () => {
      if (existing) await db.views.put(existing)
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Deciding on an offer                                                       */
/* -------------------------------------------------------------------------- */

/** Replaces the standing criteria list. */
export async function saveCriteria(criteria: DecisionCriterion[]): Promise<Undoable> {
  const settings = await db.settings.get('workspace')
  if (!settings) return { undo: async () => {} }
  const before = settings.decisionCriteria
  await db.settings.put({ ...settings, decisionCriteria: criteria, updatedAt: nowIso() })
  return {
    undo: async () => {
      const current = await db.settings.get('workspace')
      if (current) await db.settings.put({ ...current, decisionCriteria: before, updatedAt: nowIso() })
    },
  }
}

/** Records how one role rates against one criterion, or clears it. */
export async function rateOpportunity(
  id: ID,
  criterionId: string,
  rating: DecisionRating | null,
): Promise<void> {
  const before = await db.opportunities.get(id)
  if (!before) return
  const next = { ...(before.decisionRatings ?? {}) }
  if (rating === null) delete next[criterionId]
  else next[criterionId] = rating
  await db.opportunities.put({ ...before, decisionRatings: next, updatedAt: nowIso() })
}

/**
 * Closes the decision.
 *
 * Accepting moves the record to `accepted` and declining to `withdrawn`, so the
 * pipeline and the funnel agree with what you decided rather than leaving an
 * offer sitting open forever. Undoable as one step: this is a big button.
 */
export async function settleOffer(id: ID, outcome: 'accepted' | 'declined'): Promise<Undoable> {
  const before = await db.opportunities.get(id)
  if (!before?.offer) return { undo: async () => {} }
  const at = nowIso()
  const stage: Stage = outcome === 'accepted' ? 'accepted' : 'withdrawn'
  await db.opportunities.put({
    ...before,
    stage,
    stageChangedAt: at,
    stageHistory: [...(before.stageHistory ?? []), { stage, at }],
    offer: { ...before.offer, status: outcome },
    updatedAt: at,
  })
  await logEvent({
    type: outcome === 'accepted' ? 'stage_changed' : 'withdrawn',
    opportunityId: id,
    summary: outcome === 'accepted' ? 'Offer accepted' : 'Offer declined',
  })
  return {
    undo: async () => {
      await db.opportunities.put(before)
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Your own questions                                                         */
/* -------------------------------------------------------------------------- */

export type NewQuestion = Partial<CustomQuestion> & Pick<CustomQuestion, 'text' | 'theme'>

export function draftQuestion(input: NewQuestion): CustomQuestion {
  const ts = nowIso()
  return {
    id: input.id ?? newId('cq_'),
    text: input.text.trim(),
    theme: input.theme,
    also: input.also?.length ? uniq(input.also) : undefined,
    formats: input.formats?.length ? uniq(input.formats) : [...INTERVIEW_TYPES],
    listeningFor: input.listeningFor?.trim() || undefined,
    createdAt: input.createdAt ?? ts,
    updatedAt: ts,
  }
}

export async function saveQuestion(input: NewQuestion): Promise<CustomQuestion> {
  const record = draftQuestion(input)
  await db.questions.put(record)
  return record
}

/**
 * Adds a starter set as the user's own questions.
 *
 * Skips anything already present by text, so loading a set twice does not
 * duplicate it, and returns how many were actually new.
 */
export async function loadStarterQuestions(
  questions: Array<Omit<CustomQuestion, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<{ added: number; undo: () => Promise<void> }> {
  const existing = await db.questions.toArray()
  const seen = new Set(existing.map((q) => q.text.trim().toLowerCase()))
  const fresh = questions
    .filter((q) => !seen.has(q.text.trim().toLowerCase()))
    .map((q) => draftQuestion(q))
  if (fresh.length > 0) await db.questions.bulkPut(fresh)
  return {
    added: fresh.length,
    undo: async () => {
      await db.questions.bulkDelete(fresh.map((q) => q.id))
    },
  }
}

/**
 * Takes a starter set back out again.
 *
 * Symmetry matters here: adding fourteen questions is one click, so removing
 * them should be too. Only questions still matching the set's text are touched,
 * so anything you edited afterwards is treated as yours and left alone.
 */
export async function removeStarterQuestions(
  questions: Array<Pick<CustomQuestion, 'text'>>,
): Promise<{ removed: number; undo: () => Promise<void> }> {
  const wanted = new Set(questions.map((q) => q.text.trim().toLowerCase()))
  const existing = await db.questions.toArray()
  const doomed = existing.filter((q) => wanted.has(q.text.trim().toLowerCase()))
  if (doomed.length > 0) await db.questions.bulkDelete(doomed.map((q) => q.id))
  return {
    removed: doomed.length,
    undo: async () => {
      await db.questions.bulkPut(doomed)
    },
  }
}

export async function deleteQuestion(id: ID): Promise<Undoable> {
  const before = await db.questions.get(id)
  await db.questions.delete(id)
  return {
    undo: async () => {
      if (before) await db.questions.put(before)
    },
  }
}

/**
 * Sets a built-in question aside, or brings it back. Hiding is stored rather
 * than deleting because the bank is code: the list has to survive an update.
 */
export async function setQuestionHidden(id: string, hidden: boolean): Promise<Undoable> {
  const settings = await db.settings.get('workspace')
  if (!settings) return { undo: async () => {} }
  const before = settings.hiddenQuestionIds ?? []
  const next = hidden ? uniq([...before, id]) : before.filter((x) => x !== id)
  await db.settings.put({ ...settings, hiddenQuestionIds: next, updatedAt: nowIso() })
  return {
    undo: async () => {
      const current = await db.settings.get('workspace')
      if (current) await db.settings.put({ ...current, hiddenQuestionIds: before, updatedAt: nowIso() })
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Message templates                                                          */
/* -------------------------------------------------------------------------- */

export type NewTemplate = Partial<MessageTemplate> & Pick<MessageTemplate, 'name' | 'body'>

export async function saveTemplate(input: NewTemplate): Promise<MessageTemplate> {
  const ts = nowIso()
  const existing = input.id ? await db.templates.get(input.id) : undefined
  const record: MessageTemplate = {
    id: input.id ?? newId('tp_'),
    name: input.name.trim(),
    category: input.category ?? existing?.category ?? 'other',
    subject: input.subject,
    body: input.body,
    // Editing a built-in makes it yours; it is no longer marked as shipped.
    builtIn: input.id ? false : (input.builtIn ?? false),
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  }
  await db.templates.put(record)
  return record
}

export async function deleteTemplate(id: ID): Promise<Undoable> {
  const before = await db.templates.get(id)
  await db.templates.delete(id)
  return {
    undo: async () => {
      if (before) await db.templates.put(before)
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

export const EVENT_LABEL: Record<EventType, string> = {
  opportunity_created: 'Created',
  stage_changed: 'Stage',
  applied: 'Applied',
  priority_changed: 'Priority',
  next_action_set: 'Next action',
  next_action_completed: 'Completed',
  note_added: 'Note',
  contact_linked: 'Contact',
  contact_logged: 'Outreach',
  interview_created: 'Interview',
  interview_updated: 'Interview',
  interview_result: 'Result',
  follow_up_completed: 'Follow-up',
  offer_recorded: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  archived: 'Archived',
  unarchived: 'Restored',
  opportunity_updated: 'Updated',
}
