import Dexie, { type Table } from 'dexie'
import {
  DEFAULT_SETTINGS,
  type ActivityEvent,
  type Contact,
  type CustomQuestion,
  type Interview,
  type MasterProfile,
  type MessageTemplate,
  type Opportunity,
  type SavedView,
  type Snapshot,
  type Story,
  type WorkspaceSettings,
} from './types'
import { clearFitCache } from './fit-cache'
import { nowIso } from './utils'

/**
 * IndexedDB schema.
 *
 * Adding a field to an entity needs no version bump — IndexedDB stores whole
 * objects. Bump `DB_VERSION` and append a new `.version(n).stores(...).upgrade()`
 * block only when *indexes* change or stored data must be rewritten. Each
 * upgrade must be idempotent and tolerate records written by older builds.
 */
export const DB_VERSION = 4

export class OpportunityDB extends Dexie {
  opportunities!: Table<Opportunity, string>
  contacts!: Table<Contact, string>
  interviews!: Table<Interview, string>
  stories!: Table<Story, string>
  events!: Table<ActivityEvent, string>
  views!: Table<SavedView, string>
  profile!: Table<MasterProfile, string>
  settings!: Table<WorkspaceSettings, string>
  templates!: Table<MessageTemplate, string>
  snapshots!: Table<Snapshot, string>
  questions!: Table<CustomQuestion, string>

  constructor(name = 'opportunity-os') {
    super(name)
    this.version(1).stores({
      opportunities: 'id, company, role, stage, priority, dateDiscovered, dateApplied, nextActionDate, updatedAt, archivedAt, *tags',
      contacts: 'id, name, company, relationship, nextFollowUpDate, lastContactDate, updatedAt, archivedAt, *opportunityIds, *tags',
      interviews: 'id, opportunityId, scheduledAt, type, outcome, updatedAt',
      stories: 'id, title, favorite, lastUsedAt, updatedAt, *tags, *skills',
      events: 'id, at, type, opportunityId, contactId, interviewId',
      views: 'id, name, createdAt',
      profile: 'id',
      settings: 'id',
    })

    // v2 adds the message-template library. Existing rows are untouched; the
    // built-ins are written by `ensureWorkspaceDefaults` on the next load.
    this.version(2).stores({
      templates: 'id, category, name, updatedAt',
    })

    // v3 adds local restore points. They live outside the export envelope on
    // purpose: a backup file should not carry copies of older backups.
    this.version(3).stores({
      snapshots: 'id, at, reason',
    })

    // v4 adds questions the user writes themselves. They sit beside the
    // built-in bank rather than replacing it, so nothing existing changes.
    this.version(4).stores({
      questions: 'id, theme, updatedAt',
    })
  }
}

export const db = new OpportunityDB()

let defaultsInFlight: Promise<void> | null = null

/**
 * Ensures the singleton profile + settings rows exist and that the built-in
 * message templates have been written once.
 *
 * Callers can overlap — the provider mounts it, and restore and clear both call
 * it again — so the work is serialised behind one promise and the seed is
 * guarded twice: by the timestamp (so templates the user deletes stay deleted)
 * and by an emptiness check (so a concurrent caller cannot double-write).
 */
export async function ensureWorkspaceDefaults(): Promise<void> {
  if (defaultsInFlight) return defaultsInFlight
  defaultsInFlight = (async () => {
    const [profile, settings, templateCount] = await Promise.all([
      db.profile.get('master'),
      db.settings.get('workspace'),
      db.templates.count(),
    ])
    if (!profile) await db.profile.put(createDefaultProfile())

    const current = settings ?? { ...DEFAULT_SETTINGS, updatedAt: nowIso() }
    let changed = !settings
    if (!current.decisionCriteria) {
      // Seeded rather than hard-coded so the list can be edited and stays put.
      const { buildDefaultCriteria } = await import('./decision')
      current.decisionCriteria = buildDefaultCriteria()
      changed = true
    }
    if (!current.workspaceStartedAt) {
      // Left unset on an upgrade from an older workspace, where record age is
      // the better guess; only a genuinely new settings row starts the clock.
      if (!settings) current.workspaceStartedAt = nowIso()
    }
    if (!current.templatesSeededAt && templateCount === 0) {
      const { buildBuiltInTemplates } = await import('./templates')
      await db.templates.bulkPut(buildBuiltInTemplates())
      current.templatesSeededAt = nowIso()
      changed = true
    } else if (!current.templatesSeededAt) {
      // Templates already exist from an earlier run; just record that.
      current.templatesSeededAt = nowIso()
      changed = true
    }
    if (changed) await db.settings.put({ ...current, updatedAt: nowIso() })
  })().finally(() => {
    defaultsInFlight = null
  })
  return defaultsInFlight
}

export function createDefaultProfile(): MasterProfile {
  return {
    id: 'master',
    targetRoles: [],
    skills: [],
    tools: [],
    domains: [],
    industries: [],
    companyTypes: [],
    locations: [],
    remotePreference: 'flexible',
    willingToRelocate: false,
    currency: 'USD',
    desiredKeywords: [],
    undesiredKeywords: [],
    updatedAt: nowIso(),
  }
}

export const ALL_TABLES = [
  'opportunities',
  'contacts',
  'interviews',
  'stories',
  'events',
  'views',
  'templates',
  'profile',
  'settings',
] as const

/**
 * Deletes every record but leaves the database (and its schema) in place.
 * Restore points are kept unless `includeSnapshots` is set, so an accidental
 * clear stays recoverable.
 */
export async function clearAllData(options: { includeSnapshots?: boolean } = {}): Promise<void> {
  await db.transaction(
    'rw',
    [db.opportunities, db.contacts, db.interviews, db.stories, db.events, db.views, db.templates, db.questions, db.profile, db.settings],
    async () => {
      await Promise.all([
        db.opportunities.clear(),
        db.contacts.clear(),
        db.interviews.clear(),
        db.stories.clear(),
        db.events.clear(),
        db.views.clear(),
        db.templates.clear(),
        db.questions.clear(),
        db.profile.clear(),
        db.settings.clear(),
      ])
    },
  )
  if (options.includeSnapshots) await db.snapshots.clear()
  clearFitCache()
  await ensureWorkspaceDefaults()
}

export async function isWorkspaceEmpty(): Promise<boolean> {
  const [o, c, i, s] = await Promise.all([
    db.opportunities.count(),
    db.contacts.count(),
    db.interviews.count(),
    db.stories.count(),
  ])
  return o + c + i + s === 0
}

/** Rough byte estimate from the Storage API, when the browser exposes it. */
export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}
