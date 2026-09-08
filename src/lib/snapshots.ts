/**
 * Restore points.
 *
 * An export protects you from losing the browser. A restore point protects you
 * from losing the data inside it — a bad CSV import, a mass edit, an accidental
 * clear. They are written automatically, kept to a bounded number, and never
 * travel inside an export file.
 *
 * Nothing here talks to a network. A restore point is a JSON string in the same
 * IndexedDB the workspace already uses.
 */
import { db } from './db'
import { buildWorkspaceExport } from './backup'
import type { Snapshot, SnapshotReason } from './types'
import { newId, nowIso, parseAnyDate } from './utils'

/** How long an automatic restore point stays fresh before another is taken. */
export const AUTO_INTERVAL_HOURS = 12

/** Automatic points are pruned first; deliberate ones survive longer. */
const MAX_AUTOMATIC = 6
const MAX_DELIBERATE = 6

/** Below this the workspace is not worth snapshotting. */
const MIN_RECORDS = 3

function isDeliberate(reason: SnapshotReason): boolean {
  return reason !== 'automatic'
}

export interface SnapshotSummary {
  id: string
  at: string
  reason: SnapshotReason
  counts: Record<string, number>
  bytes: number
}

/** Restore points newest first, without their payloads. */
export async function listSnapshots(): Promise<SnapshotSummary[]> {
  const all = await db.snapshots.orderBy('at').reverse().toArray()
  return all.map(({ id, at, reason, counts, bytes }) => ({ id, at, reason, counts, bytes }))
}

export async function snapshotStorageBytes(): Promise<number> {
  const all = await db.snapshots.toArray()
  return all.reduce((total, s) => total + s.bytes, 0)
}

/**
 * Writes a restore point. Returns null when there is nothing worth keeping,
 * or when storage refuses the write — a failed snapshot must never block the
 * action it was protecting.
 */
export async function takeSnapshot(reason: SnapshotReason): Promise<Snapshot | null> {
  try {
    const payload = await buildWorkspaceExport()
    const total = Object.values(payload.counts).reduce((a, b) => a + b, 0)
    if (total < MIN_RECORDS) return null

    const serialised = JSON.stringify(payload)
    const record: Snapshot = {
      id: newId('sn_'),
      at: nowIso(),
      reason,
      counts: payload.counts,
      payload: serialised,
      bytes: serialised.length,
    }
    await db.snapshots.put(record)
    await pruneSnapshots()
    return record
  } catch (error) {
    console.warn('Could not write a restore point; the workspace itself is unaffected.', error)
    return null
  }
}

/** Keeps the newest few of each kind and drops the rest. */
export async function pruneSnapshots(): Promise<void> {
  const all = await db.snapshots.orderBy('at').reverse().toArray()
  const automatic: string[] = []
  const deliberate: string[] = []
  const doomed: string[] = []

  for (const snapshot of all) {
    const bucket = isDeliberate(snapshot.reason) ? deliberate : automatic
    const limit = isDeliberate(snapshot.reason) ? MAX_DELIBERATE : MAX_AUTOMATIC
    if (bucket.length < limit) bucket.push(snapshot.id)
    else doomed.push(snapshot.id)
  }
  if (doomed.length > 0) await db.snapshots.bulkDelete(doomed)
}

/**
 * Takes an automatic restore point if the last one has aged out. Called on
 * start-up; deliberately cheap when there is nothing to do.
 */
export async function maybeTakeAutomaticSnapshot(): Promise<void> {
  try {
    const latest = await db.snapshots.orderBy('at').last()
    if (latest) {
      const at = parseAnyDate(latest.at)
      const ageHours = at ? (Date.now() - at.getTime()) / 3_600_000 : Number.POSITIVE_INFINITY
      if (ageHours < AUTO_INTERVAL_HOURS) return
    }
    await takeSnapshot('automatic')
  } catch {
    // Snapshotting is best-effort; never surface it as a start-up failure.
  }
}

export async function readSnapshot(id: string): Promise<unknown | null> {
  const record = await db.snapshots.get(id)
  if (!record) return null
  try {
    return JSON.parse(record.payload)
  } catch {
    return null
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.snapshots.delete(id)
}

export async function deleteAllSnapshots(): Promise<void> {
  await db.snapshots.clear()
}

/* -------------------------------------------------------------------------- */
/*  Storage durability                                                         */
/* -------------------------------------------------------------------------- */

export type PersistenceState = 'persisted' | 'transient' | 'unsupported'

/**
 * Browsers may evict IndexedDB for a site they consider disposable. Asking for
 * persistent storage is the difference between "your data is on this device"
 * and "your data is on this device until the browser needs the space".
 */
export async function checkPersistence(): Promise<PersistenceState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return 'unsupported'
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'transient'
  } catch {
    return 'unsupported'
  }
}

/**
 * Requests durable storage. Some browsers grant it silently on engagement,
 * some prompt, some always refuse — the caller reports whatever comes back
 * rather than assuming success.
 */
export async function requestPersistence(): Promise<PersistenceState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported'
  try {
    const granted = await navigator.storage.persist()
    return granted ? 'persisted' : 'transient'
  } catch {
    return 'unsupported'
  }
}
