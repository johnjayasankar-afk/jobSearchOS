/**
 * Memoised fit scoring.
 *
 * `computeFit` walks the job description and the whole profile, so recomputing
 * it for every opportunity on every workspace change is the single most
 * expensive thing the app does. Every mutation goes through `repo`, which
 * always stamps `updatedAt`, so the pair (record stamp, profile stamp) is a
 * sound cache key: if neither has changed, neither has the score.
 */
import { computeFit, type FitResult } from './fit'
import type { MasterProfile, Opportunity } from './types'

const MAX_ENTRIES = 4000

const cache = new Map<string, FitResult>()

function profileStamp(profile: MasterProfile | null | undefined): string {
  return profile ? profile.updatedAt : 'none'
}

function keyFor(opportunity: Opportunity, stamp: string): string {
  return `${opportunity.id}|${opportunity.updatedAt}|${stamp}`
}

export function cachedFit(
  opportunity: Opportunity,
  profile: MasterProfile | null | undefined,
): FitResult {
  const key = keyFor(opportunity, profileStamp(profile))
  const hit = cache.get(key)
  if (hit) return hit

  const result = computeFit(opportunity, profile)
  // Cheapest sound eviction: once the cache is clearly stale-heavy, drop it.
  // Entries are only ever invalidated by a new stamp, so nothing is lost.
  if (cache.size >= MAX_ENTRIES) cache.clear()
  cache.set(key, result)
  return result
}

/** Builds the id → score map the whole UI shares for one render pass. */
export function buildFitMap(
  opportunities: Opportunity[],
  profile: MasterProfile | null | undefined,
): Map<string, FitResult> {
  const stamp = profileStamp(profile)
  const map = new Map<string, FitResult>()
  for (const o of opportunities) {
    const key = keyFor(o, stamp)
    let result = cache.get(key)
    if (!result) {
      result = computeFit(o, profile)
      if (cache.size >= MAX_ENTRIES) cache.clear()
      cache.set(key, result)
    }
    map.set(o.id, result)
  }
  return map
}

/** Used when the workspace is replaced wholesale (restore, clear, demo seed). */
export function clearFitCache(): void {
  cache.clear()
}
