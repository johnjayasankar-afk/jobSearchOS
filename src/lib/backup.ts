/**
 * Workspace backup and restore.
 *
 * A restore replaces live data, so the payload is validated field by field
 * before anything is written. Unknown records are rejected with a readable
 * reason rather than being silently coerced, and a restore only commits if the
 * whole transaction succeeds.
 */
import { db, ensureWorkspaceDefaults, createDefaultProfile } from './db'
import {
  ANSWER_VERDICTS,
  CRITERION_WEIGHTS,
  DECISION_RATINGS,
  STORY_TAGS,
  DEBRIEF_READS,
  MAX_RECENT_RUNS,
  REHEARSAL_RATINGS,
  DEFAULT_SETTINGS,
  EMPTY_FILTERS,
  INTERVIEW_FORMATS,
  INTERVIEW_OUTCOMES,
  INTERVIEW_TYPES,
  PRIORITIES,
  RELATIONSHIPS,
  SCHEMA_VERSION,
  SENIORITY_LEVELS,
  STAGES,
  TEMPLATE_CATEGORIES,
  WORK_ARRANGEMENTS,
  type ActivityEvent,
  type Contact,
  type Interview,
  type MasterProfile,
  type CustomQuestion,
  type DecisionCriterion,
  type DecisionRating,
  type InterviewType,
  type MessageTemplate,
  type StoryTag,
  type Opportunity,
  type OpportunityFilters,
  type Priority,
  type SavedView,
  type Stage,
  type Story,
  type WorkArrangement,
  type WorkspaceExport,
  type WorkspaceSettings,
} from './types'
import { daysSince, newId, nowIso, today } from './utils'

export const APP_VERSION = '3.7.0'

/**
 * Local-first means the browser is the only copy. This turns the last export
 * date into something the UI can act on, so the risk is visible rather than
 * discovered the day the profile is wiped.
 */
export interface BackupHealth {
  state: 'none-needed' | 'never' | 'stale' | 'fresh'
  days: number | null
  /** Worth interrupting the user for. */
  nudge: boolean
  label: string
}

const STALE_AFTER_DAYS = 14
const NUDGE_AFTER_DAYS = 21
/** Below this, losing the workspace costs minutes, not weeks. */
const MIN_RECORDS_TO_CARE = 5

/**
 * @param workspaceAgeDays How long there has been anything here to lose. A
 * workspace that is minutes old has not earned a warning yet, however many
 * records were just seeded into it.
 */
export function describeBackupHealth(
  lastBackupAt: string | undefined,
  recordCount: number,
  workspaceAgeDays: number | null = null,
): BackupHealth {
  if (recordCount < MIN_RECORDS_TO_CARE) {
    return { state: 'none-needed', days: null, nudge: false, label: 'Nothing worth backing up yet' }
  }
  if (!lastBackupAt) {
    return {
      state: 'never',
      days: null,
      nudge: workspaceAgeDays !== null && workspaceAgeDays >= NUDGE_AFTER_DAYS,
      label: 'Never exported',
    }
  }
  const days = daysSince(lastBackupAt) ?? 0
  if (days >= STALE_AFTER_DAYS) {
    return {
      state: 'stale',
      days,
      nudge: days >= NUDGE_AFTER_DAYS,
      label: `Last exported ${days} days ago`,
    }
  }
  return {
    state: 'fresh',
    days,
    nudge: false,
    label: days <= 0 ? 'Exported today' : `Exported ${days} ${days === 1 ? 'day' : 'days'} ago`,
  }
}

/** Records that a full export just happened. */
export async function markBackupTaken(): Promise<void> {
  const current = await db.settings.get('workspace')
  await db.settings.put({
    ...(current ?? { ...DEFAULT_SETTINGS, updatedAt: nowIso() }),
    lastBackupAt: nowIso(),
    updatedAt: nowIso(),
  })
}

/* ------------------------------- export ----------------------------------- */

export async function buildWorkspaceExport(): Promise<WorkspaceExport> {
  const [opportunities, contacts, interviews, stories, events, views, templates, questions, profile, settings] =
    await Promise.all([
      db.opportunities.toArray(),
      db.contacts.toArray(),
      db.interviews.toArray(),
      db.stories.toArray(),
      db.events.toArray(),
      db.views.toArray(),
      db.templates.toArray(),
      db.questions.toArray(),
      db.profile.get('master'),
      db.settings.get('workspace'),
    ])

  return {
    format: 'opportunity-os.workspace',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    appVersion: APP_VERSION,
    counts: {
      opportunities: opportunities.length,
      contacts: contacts.length,
      interviews: interviews.length,
      stories: stories.length,
      events: events.length,
      views: views.length,
      templates: templates.length,
      questions: questions.length,
    },
    data: {
      opportunities,
      contacts,
      interviews,
      stories,
      events,
      views,
      templates,
      questions,
      profile: profile ?? null,
      settings: settings ?? null,
    },
  }
}

/* ------------------------------ validation -------------------------------- */

export interface ValidationReport {
  ok: boolean
  fatal: string | null
  warnings: string[]
  counts: Record<string, number>
  exportedAt?: string
  schemaVersion?: number
  /** Sanitised, ready-to-write records. Empty when `ok` is false. */
  payload: WorkspaceExport['data'] | null
}

type Rec = Record<string, unknown>

const isObject = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback)
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
/** Like `oneOf`, but an absent or unrecognised value stays absent. */
const maybeOneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined
const iso = (v: unknown, fallback: string): string => {
  const s = str(v)
  if (!s) return fallback
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? fallback : s
}
const dateOnly = (v: unknown): string | undefined => {
  const s = str(v)
  if (!s) return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined
}

/** Rebuilds a saved view's filter object from `EMPTY_FILTERS`, so an old or
 *  hand-edited backup can never inject unexpected filter keys. */
function sanitizeFilters(raw: unknown): OpportunityFilters {
  const base: OpportunityFilters = { ...EMPTY_FILTERS }
  if (!isObject(raw)) return base
  const clampScore = (v: unknown, fallback: number) => {
    const n = num(v)
    return n === undefined ? fallback : Math.min(100, Math.max(0, Math.round(n)))
  }
  return {
    query: str(raw.query) ?? '',
    stages: strArray(raw.stages).filter((s): s is Stage => (STAGES as readonly string[]).includes(s)),
    priorities: strArray(raw.priorities).filter((p): p is Priority => (PRIORITIES as readonly string[]).includes(p)),
    arrangements: strArray(raw.arrangements).filter((a): a is WorkArrangement =>
      (WORK_ARRANGEMENTS as readonly string[]).includes(a),
    ),
    tags: strArray(raw.tags),
    sources: strArray(raw.sources),
    locationQuery: str(raw.locationQuery) ?? '',
    fitMin: clampScore(raw.fitMin, 0),
    fitMax: clampScore(raw.fitMax, 100),
    dateField: oneOf(raw.dateField, ['dateDiscovered', 'dateApplied', 'updatedAt'] as const, 'dateDiscovered'),
    dateWithinDays: num(raw.dateWithinDays) ?? null,
    archived: oneOf(raw.archived, ['active', 'archived', 'all'] as const, 'active'),
    hasNextAction: oneOf(raw.hasNextAction, ['any', 'yes', 'no', 'overdue'] as const, 'any'),
  }
}

export function validateWorkspace(raw: unknown): ValidationReport {
  const warnings: string[] = []
  const fail = (message: string): ValidationReport => ({
    ok: false,
    fatal: message,
    warnings,
    counts: {},
    payload: null,
  })

  if (!isObject(raw)) return fail('The file does not contain a JSON object.')
  if (raw.format !== 'opportunity-os.workspace') {
    return fail('This is not an Opportunity OS backup. Expected a file exported from Settings → Data.')
  }
  const schemaVersion = num(raw.schemaVersion) ?? 0
  if (schemaVersion > SCHEMA_VERSION) {
    return fail(
      `This backup was written by a newer version of Opportunity OS (schema ${schemaVersion}; this build reads up to ${SCHEMA_VERSION}). Update the app and try again.`,
    )
  }
  if (!isObject(raw.data)) return fail('The backup is missing its "data" section.')
  const data = raw.data

  const ts = nowIso()

  /* -- opportunities -- */
  const opportunities: Opportunity[] = []
  const seenIds = new Set<string>()
  const rawOpps = Array.isArray(data.opportunities) ? data.opportunities : []
  for (const [i, item] of rawOpps.entries()) {
    if (!isObject(item)) {
      warnings.push(`Opportunity ${i + 1} was not an object and was skipped.`)
      continue
    }
    const company = str(item.company)
    const role = str(item.role)
    if (!company || !role) {
      warnings.push(`Opportunity ${i + 1} is missing a company or role and was skipped.`)
      continue
    }
    let id = str(item.id) ?? newId('op_')
    if (seenIds.has(id)) {
      warnings.push(`Duplicate opportunity id "${id}" was given a new id.`)
      id = newId('op_')
    }
    seenIds.add(id)
    const stage = oneOf(item.stage, STAGES, 'saved')
    const createdAt = iso(item.createdAt, ts)
    const rawHistory = Array.isArray(item.stageHistory) ? item.stageHistory : []
    const stageHistory = rawHistory
      .filter(isObject)
      .map((v) => ({ stage: oneOf(v.stage, STAGES, 'saved'), at: iso(v.at, createdAt) }))

    opportunities.push({
      id,
      company,
      role,
      jobUrl: str(item.jobUrl),
      location: str(item.location),
      workArrangement: oneOf(item.workArrangement, WORK_ARRANGEMENTS, 'unknown'),
      salaryMin: num(item.salaryMin),
      salaryMax: num(item.salaryMax),
      currency: str(item.currency) ?? 'USD',
      source: str(item.source),
      dateDiscovered: dateOnly(item.dateDiscovered) ?? today(),
      dateApplied: dateOnly(item.dateApplied),
      deadline: dateOnly(item.deadline),
      stage,
      priority: oneOf(item.priority, PRIORITIES, 'medium'),
      interestScore: num(item.interestScore),
      companyScore: num(item.companyScore),
      roleScore: num(item.roleScore),
      jobDescription: str(item.jobDescription),
      whyInterested: str(item.whyInterested),
      strengths: str(item.strengths),
      concerns: str(item.concerns),
      notes: str(item.notes),
      tags: strArray(item.tags),
      nextAction: str(item.nextAction),
      nextActionDate: dateOnly(item.nextActionDate),
      rejection: isObject(item.rejection)
        ? {
            date: dateOnly(item.rejection.date),
            stage: typeof item.rejection.stage === 'string' ? oneOf(item.rejection.stage, STAGES, 'applied') : undefined,
            reason: str(item.rejection.reason),
            notes: str(item.rejection.notes),
          }
        : undefined,
      offer: isObject(item.offer)
        ? {
            date: dateOnly(item.offer.date),
            baseSalary: num(item.offer.baseSalary),
            bonus: num(item.offer.bonus),
            equity: str(item.offer.equity),
            currency: str(item.offer.currency),
            decisionDeadline: dateOnly(item.offer.decisionDeadline),
            status: oneOf(item.offer.status, ['received', 'negotiating', 'accepted', 'declined', 'expired'] as const, 'received'),
            notes: str(item.offer.notes),
          }
        : undefined,
      decisionRatings: isObject(item.decisionRatings)
        ? Object.fromEntries(
            Object.entries(item.decisionRatings).flatMap(([key, value]) =>
              typeof value === 'string' && (DECISION_RATINGS as readonly string[]).includes(value)
                ? [[key, value as DecisionRating]]
                : [],
            ),
          )
        : undefined,
      archivedAt: str(item.archivedAt),
      createdAt,
      updatedAt: iso(item.updatedAt, createdAt),
      stageChangedAt: iso(item.stageChangedAt, createdAt),
      stageHistory: stageHistory.length > 0 ? stageHistory : [{ stage, at: createdAt }],
    })
  }

  /* -- contacts -- */
  const contacts: Contact[] = []
  const contactIds = new Set<string>()
  for (const [i, item] of (Array.isArray(data.contacts) ? data.contacts : []).entries()) {
    if (!isObject(item)) continue
    const name = str(item.name)
    if (!name) {
      warnings.push(`Contact ${i + 1} has no name and was skipped.`)
      continue
    }
    let id = str(item.id) ?? newId('ct_')
    if (contactIds.has(id)) id = newId('ct_')
    contactIds.add(id)
    const createdAt = iso(item.createdAt, ts)
    contacts.push({
      id,
      name,
      company: str(item.company),
      title: str(item.title),
      linkedinUrl: str(item.linkedinUrl),
      email: str(item.email),
      phone: str(item.phone),
      relationship: oneOf(item.relationship, RELATIONSHIPS, 'other'),
      opportunityIds: strArray(item.opportunityIds).filter((id2) => seenIds.has(id2)),
      lastContactDate: dateOnly(item.lastContactDate),
      nextFollowUpDate: dateOnly(item.nextFollowUpDate),
      notes: str(item.notes),
      tags: strArray(item.tags),
      archivedAt: str(item.archivedAt),
      createdAt,
      updatedAt: iso(item.updatedAt, createdAt),
    })
  }

  /* -- stories -- */
  const stories: Story[] = []
  const storyIds = new Set<string>()
  for (const [i, item] of (Array.isArray(data.stories) ? data.stories : []).entries()) {
    if (!isObject(item)) continue
    const title = str(item.title)
    if (!title) {
      warnings.push(`Story ${i + 1} has no title and was skipped.`)
      continue
    }
    let id = str(item.id) ?? newId('st_')
    if (storyIds.has(id)) id = newId('st_')
    storyIds.add(id)
    const createdAt = iso(item.createdAt, ts)
    stories.push({
      id,
      title,
      situation: str(item.situation),
      task: str(item.task),
      action: str(item.action),
      result: str(item.result),
      metrics: str(item.metrics),
      skills: strArray(item.skills),
      tags: strArray(item.tags),
      favorite: bool(item.favorite),
      lastUsedAt: str(item.lastUsedAt),
      useCount: Math.max(0, Math.round(num(item.useCount) ?? 0)),
      rehearsalCount: Math.max(0, Math.round(num(item.rehearsalCount) ?? 0)),
      lastRehearsedAt: str(item.lastRehearsedAt),
      lastRehearsalRating: maybeOneOf(item.lastRehearsalRating, REHEARSAL_RATINGS),
      recentRuns: Array.isArray(item.recentRuns)
        ? item.recentRuns
            .filter(isObject)
            .flatMap((r) => {
              const seconds = num(r.seconds)
              const at = str(r.at)
              if (!at || seconds === undefined || seconds <= 0) return []
              return [
                {
                  at,
                  seconds: Math.round(seconds),
                  rating: oneOf(r.rating, REHEARSAL_RATINGS, 'solid'),
                },
              ]
            })
            .slice(0, MAX_RECENT_RUNS)
        : undefined,
      createdAt,
      updatedAt: iso(item.updatedAt, createdAt),
    })
  }

  /* -- interviews -- */
  const interviews: Interview[] = []
  const interviewIds = new Set<string>()
  for (const [i, item] of (Array.isArray(data.interviews) ? data.interviews : []).entries()) {
    if (!isObject(item)) continue
    const opportunityId = str(item.opportunityId)
    if (!opportunityId || !seenIds.has(opportunityId)) {
      warnings.push(`Interview ${i + 1} points at an opportunity that is not in the file and was skipped.`)
      continue
    }
    const scheduledAt = str(item.scheduledAt)
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
      warnings.push(`Interview ${i + 1} has an unreadable date and was skipped.`)
      continue
    }
    let id = str(item.id) ?? newId('iv_')
    if (interviewIds.has(id)) id = newId('iv_')
    interviewIds.add(id)
    const createdAt = iso(item.createdAt, ts)
    interviews.push({
      id,
      opportunityId,
      scheduledAt,
      durationMinutes: Math.max(5, Math.round(num(item.durationMinutes) ?? 45)),
      type: oneOf(item.type, INTERVIEW_TYPES, 'other'),
      format: oneOf(item.format, INTERVIEW_FORMATS, 'video'),
      contactIds: strArray(item.contactIds).filter((cid) => contactIds.has(cid)),
      interviewers: str(item.interviewers),
      prepNotes: str(item.prepNotes),
      questionsExpected: strArray(item.questionsExpected),
      questionsToAsk: strArray(item.questionsToAsk),
      checklist: Array.isArray(item.checklist)
        ? item.checklist.filter(isObject).flatMap((c) => {
            const text = str(c.text)
            return text ? [{ id: str(c.id) ?? newId('ck_'), text, done: bool(c.done) }] : []
          })
        : [],
      storyIds: strArray(item.storyIds).filter((sid) => storyIds.has(sid)),
      outcome: oneOf(item.outcome, INTERVIEW_OUTCOMES, 'pending'),
      debrief: str(item.debrief),
      debriefedAt: str(item.debriefedAt),
      debriefRead: maybeOneOf(item.debriefRead, DEBRIEF_READS),
      outcomeAskedAt: str(item.outcomeAskedAt),
      askedQuestions: Array.isArray(item.askedQuestions)
        ? item.askedQuestions.filter(isObject).flatMap((a) => {
            const questionId = str(a.questionId)
            const text = str(a.text)
            if (!questionId && !text) return []
            return [{ questionId, text, verdict: oneOf(a.verdict, ANSWER_VERDICTS, 'ok') }]
          })
        : undefined,
      followUpSent: bool(item.followUpSent),
      followUpDueDate: dateOnly(item.followUpDueDate),
      createdAt,
      updatedAt: iso(item.updatedAt, createdAt),
    })
  }

  /* -- events -- */
  const events: ActivityEvent[] = []
  for (const item of Array.isArray(data.events) ? data.events : []) {
    if (!isObject(item)) continue
    const summary = str(item.summary)
    const type = str(item.type)
    if (!summary || !type) continue
    events.push({
      id: str(item.id) ?? newId('ev_'),
      at: iso(item.at, ts),
      type: type as ActivityEvent['type'],
      opportunityId: str(item.opportunityId),
      contactId: str(item.contactId),
      interviewId: str(item.interviewId),
      summary,
      detail: str(item.detail),
    })
  }

  /* -- views -- */
  const views: SavedView[] = []
  for (const item of Array.isArray(data.views) ? data.views : []) {
    if (!isObject(item)) continue
    const name = str(item.name)
    if (!name || !isObject(item.filters)) continue
    views.push({
      id: str(item.id) ?? newId('vw_'),
      name,
      pinned: bool(item.pinned),
      filters: sanitizeFilters(item.filters),
      sortBy: (str(item.sortBy) ?? 'updatedAt') as SavedView['sortBy'],
      sortDir: item.sortDir === 'asc' ? 'asc' : 'desc',
      columns: strArray(item.columns) as SavedView['columns'],
      createdAt: iso(item.createdAt, ts),
    })
  }

  /* -- message templates -- */
  const templates: MessageTemplate[] = []
  const templateIds = new Set<string>()
  for (const item of Array.isArray(data.templates) ? data.templates : []) {
    if (!isObject(item)) continue
    const name = str(item.name)
    const body = str(item.body)
    if (!name || !body) continue
    let id = str(item.id) ?? newId('tp_')
    if (templateIds.has(id)) id = newId('tp_')
    templateIds.add(id)
    const createdAt = iso(item.createdAt, ts)
    templates.push({
      id,
      name,
      category: oneOf(item.category, TEMPLATE_CATEGORIES, 'other'),
      subject: str(item.subject),
      body,
      builtIn: bool(item.builtIn),
      createdAt,
      updatedAt: iso(item.updatedAt, createdAt),
    })
  }

  /* -- your own questions -- */
  const questions: CustomQuestion[] = []
  const questionIds = new Set<string>()
  for (const item of Array.isArray(data.questions) ? data.questions : []) {
    if (!isObject(item)) continue
    const text = str(item.text)
    if (!text) continue
    let id = str(item.id) ?? newId('cq_')
    if (questionIds.has(id)) id = newId('cq_')
    questionIds.add(id)
    const createdAt = iso(item.createdAt, ts)
    const formats = strArray(item.formats).filter((f): f is InterviewType =>
      (INTERVIEW_TYPES as readonly string[]).includes(f),
    )
    questions.push({
      id,
      text,
      theme: oneOf(item.theme, STORY_TAGS, 'Leadership'),
      also: strArray(item.also).filter((t): t is StoryTag =>
        (STORY_TAGS as readonly string[]).includes(t),
      ),
      formats: formats.length > 0 ? formats : [...INTERVIEW_TYPES],
      listeningFor: str(item.listeningFor),
      createdAt,
      updatedAt: iso(item.updatedAt, createdAt),
    })
  }

  /* -- profile & settings -- */
  const rawProfile = isObject(data.profile) ? data.profile : null
  const profile: MasterProfile = rawProfile
    ? {
        id: 'master',
        name: str(rawProfile.name),
        targetRoles: strArray(rawProfile.targetRoles),
        seniority:
          typeof rawProfile.seniority === 'string' && (SENIORITY_LEVELS as readonly string[]).includes(rawProfile.seniority)
            ? (rawProfile.seniority as MasterProfile['seniority'])
            : undefined,
        yearsExperience: num(rawProfile.yearsExperience),
        skills: strArray(rawProfile.skills),
        tools: strArray(rawProfile.tools),
        domains: strArray(rawProfile.domains),
        industries: strArray(rawProfile.industries),
        companyTypes: strArray(rawProfile.companyTypes),
        locations: strArray(rawProfile.locations),
        remotePreference: oneOf(rawProfile.remotePreference, ['remote', 'hybrid', 'onsite', 'flexible'] as const, 'flexible'),
        willingToRelocate: bool(rawProfile.willingToRelocate),
        minCompensation: num(rawProfile.minCompensation),
        currency: str(rawProfile.currency) ?? 'USD',
        desiredKeywords: strArray(rawProfile.desiredKeywords),
        undesiredKeywords: strArray(rawProfile.undesiredKeywords),
        updatedAt: iso(rawProfile.updatedAt, ts),
      }
    : createDefaultProfile()

  const rawSettings = isObject(data.settings) ? data.settings : null
  const positiveInt = (v: unknown, fallback: number): number => {
    const n = num(v)
    return n !== undefined && n > 0 && n < 3650 ? Math.round(n) : fallback
  }
  const settings: WorkspaceSettings = {
    id: 'workspace',
    staleOpportunityDays: positiveInt(rawSettings?.staleOpportunityDays, DEFAULT_SETTINGS.staleOpportunityDays),
    staleContactDays: positiveInt(rawSettings?.staleContactDays, DEFAULT_SETTINGS.staleContactDays),
    applicationFollowUpDays: positiveInt(rawSettings?.applicationFollowUpDays, DEFAULT_SETTINGS.applicationFollowUpDays),
    interviewFollowUpDays: positiveInt(rawSettings?.interviewFollowUpDays, DEFAULT_SETTINGS.interviewFollowUpDays),
    weeklyApplicationTarget: positiveInt(rawSettings?.weeklyApplicationTarget, DEFAULT_SETTINGS.weeklyApplicationTarget),
    weeklyNetworkingTarget: positiveInt(rawSettings?.weeklyNetworkingTarget, DEFAULT_SETTINGS.weeklyNetworkingTarget),
    decisionCriteria: Array.isArray(rawSettings?.decisionCriteria)
      ? rawSettings.decisionCriteria.filter(isObject).flatMap((c): DecisionCriterion[] => {
          const label = str(c.label)
          if (!label) return []
          const weight = num(c.weight)
          return [
            {
              id: str(c.id) ?? newId('dc_'),
              label,
              weight: (CRITERION_WEIGHTS as readonly number[]).includes(weight ?? 0)
                ? (weight as DecisionCriterion['weight'])
                : 2,
            },
          ]
        })
      : undefined,
    // A restored file has already been seeded; never re-add built-ins over it.
    templatesSeededAt: str(rawSettings?.templatesSeededAt) ?? (templates.length > 0 ? ts : undefined),
    lastBackupAt: str(rawSettings?.lastBackupAt),
    lastReviewAt: str(rawSettings?.lastReviewAt),
    updatedAt: ts,
  }

  const totalRecords = opportunities.length + contacts.length + interviews.length + stories.length
  if (totalRecords === 0) {
    return fail('The backup contains no opportunities, contacts, interviews or stories.')
  }

  return {
    ok: true,
    fatal: null,
    warnings,
    exportedAt: str(raw.exportedAt),
    schemaVersion,
    counts: {
      opportunities: opportunities.length,
      contacts: contacts.length,
      interviews: interviews.length,
      stories: stories.length,
      events: events.length,
      views: views.length,
      templates: templates.length,
      questions: questions.length,
    },
    payload: { opportunities, contacts, interviews, stories, events, views, templates, questions, profile, settings },
  }
}

export type RestoreMode = 'replace' | 'merge'

/**
 * Writes a validated payload. `replace` clears the workspace first; `merge`
 * keeps existing records and re-ids incoming ones that would collide.
 */
export async function restoreWorkspace(
  payload: WorkspaceExport['data'],
  mode: RestoreMode,
): Promise<{ written: Record<string, number> }> {
  // A restore is the most destructive thing the app can do to existing data,
  // so the state before it is kept as a restore point.
  const { takeSnapshot } = await import('./snapshots')
  await takeSnapshot('before-restore')

  let data = payload
  if (mode === 'merge') data = await remapForMerge(payload)

  await db.transaction(
    'rw',
    [db.opportunities, db.contacts, db.interviews, db.stories, db.events, db.views, db.templates, db.questions, db.profile, db.settings],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.opportunities.clear(),
          db.contacts.clear(),
          db.interviews.clear(),
          db.stories.clear(),
          db.events.clear(),
          db.views.clear(),
          db.templates.clear(),
          db.questions.clear(),
        ])
      }
      await db.opportunities.bulkPut(data.opportunities)
      await db.contacts.bulkPut(data.contacts)
      await db.stories.bulkPut(data.stories)
      await db.interviews.bulkPut(data.interviews)
      await db.events.bulkPut(data.events)
      await db.views.bulkPut(data.views)
      await db.templates.bulkPut(data.templates)
      await db.questions.bulkPut(data.questions)
      if (mode === 'replace') {
        if (data.profile) await db.profile.put(data.profile)
        if (data.settings) await db.settings.put(data.settings)
      }
    },
  )
  await ensureWorkspaceDefaults()

  return {
    written: {
      opportunities: data.opportunities.length,
      contacts: data.contacts.length,
      interviews: data.interviews.length,
      stories: data.stories.length,
    },
  }
}

/** Gives colliding ids fresh values so a merge never overwrites live records. */
async function remapForMerge(payload: WorkspaceExport['data']): Promise<WorkspaceExport['data']> {
  const [existingOpps, existingContacts, existingStories, existingInterviews] = await Promise.all([
    db.opportunities.toCollection().primaryKeys(),
    db.contacts.toCollection().primaryKeys(),
    db.stories.toCollection().primaryKeys(),
    db.interviews.toCollection().primaryKeys(),
  ])
  const oppMap = new Map<string, string>()
  const contactMap = new Map<string, string>()
  const storyMap = new Map<string, string>()
  const interviewMap = new Map<string, string>()

  const remap = (ids: unknown[], map: Map<string, string>, prefix: string, existing: string[]) => {
    const set = new Set(existing.map(String))
    for (const id of ids as string[]) {
      map.set(id, set.has(id) ? newId(prefix) : id)
    }
  }
  remap(payload.opportunities.map((o) => o.id), oppMap, 'op_', existingOpps as string[])
  remap(payload.contacts.map((c) => c.id), contactMap, 'ct_', existingContacts as string[])
  remap(payload.stories.map((s) => s.id), storyMap, 'st_', existingStories as string[])
  remap(payload.interviews.map((i) => i.id), interviewMap, 'iv_', existingInterviews as string[])

  return {
    ...payload,
    opportunities: payload.opportunities.map((o) => ({ ...o, id: oppMap.get(o.id) ?? o.id })),
    contacts: payload.contacts.map((c) => ({
      ...c,
      id: contactMap.get(c.id) ?? c.id,
      opportunityIds: c.opportunityIds.map((id) => oppMap.get(id) ?? id),
    })),
    stories: payload.stories.map((s) => ({ ...s, id: storyMap.get(s.id) ?? s.id })),
    interviews: payload.interviews.map((i) => ({
      ...i,
      id: interviewMap.get(i.id) ?? i.id,
      opportunityId: oppMap.get(i.opportunityId) ?? i.opportunityId,
      contactIds: i.contactIds.map((id) => contactMap.get(id) ?? id),
      storyIds: i.storyIds.map((id) => storyMap.get(id) ?? id),
    })),
    events: payload.events.map((e) => ({
      ...e,
      id: newId('ev_'),
      opportunityId: e.opportunityId ? (oppMap.get(e.opportunityId) ?? e.opportunityId) : undefined,
      contactId: e.contactId ? (contactMap.get(e.contactId) ?? e.contactId) : undefined,
      interviewId: e.interviewId ? (interviewMap.get(e.interviewId) ?? e.interviewId) : undefined,
    })),
    views: payload.views.map((v) => ({ ...v, id: newId('vw_') })),
    templates: payload.templates.map((t) => ({ ...t, id: newId('tp_') })),
  }
}

/* ------------------------------ downloads --------------------------------- */

export function downloadFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function timestampedFilename(base: string, ext: string): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`
  return `${base}-${stamp}.${ext}`
}
