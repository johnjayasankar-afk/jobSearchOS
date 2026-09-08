/**
 * Small interview-preparation facts the agenda needs on every load.
 *
 * Kept apart from the question bank on purpose. Today has to know whether an
 * interview's stories are practised and whether it still wants a debrief;
 * answering either from `questions.ts` would drag 35 interview questions into
 * the entry chunk for the sake of a few lines. Anything here must stay free of
 * that import.
 */
import { MAX_RECENT_RUNS, type Interview, type RehearsalRun, type Story } from './types'
import { daysSince } from './utils'

/** How long a story stays "sharp" after a rehearsal you were happy with. */
export const SHARP_FOR_DAYS = 21

export type Sharpness = 'sharp' | 'fading' | 'shaky' | 'untested'

export const SHARPNESS_META: Record<Sharpness, { label: string; hint: string }> = {
  sharp: { label: 'Sharp', hint: `Rehearsed in the last ${SHARP_FOR_DAYS} days and it went well.` },
  fading: { label: 'Fading', hint: `Last good run was over ${SHARP_FOR_DAYS} days ago.` },
  shaky: { label: 'Needs work', hint: 'You marked the last run as rough.' },
  untested: { label: 'Untested', hint: 'Written down, never said out loud.' },
}

/**
 * Where a story stands, from your own last verdict on it. This is
 * self-reported by design: nothing here judges the content of an answer, only
 * whether you have practised it and what you thought at the time.
 */
export function sharpnessOf(story: Story, now = new Date()): Sharpness {
  if (!story.rehearsalCount) return 'untested'
  if (story.lastRehearsalRating === 'shaky') return 'shaky'
  const days = daysSince(story.lastRehearsedAt, now)
  if (days === null) return 'untested'
  return days <= SHARP_FOR_DAYS ? 'sharp' : 'fading'
}

export interface RehearsalReadiness {
  /** Stories pinned to the interview. */
  total: number
  sharp: number
  /** Pinned stories that are untested or were rough last time. */
  needWork: Story[]
}

/** How rehearsed the stories pinned to one interview are. */
export function rehearsalReadiness(
  storyIds: string[],
  stories: Story[],
  now = new Date(),
): RehearsalReadiness {
  const pinned = storyIds
    .map((id) => stories.find((s) => s.id === id))
    .filter((s): s is Story => Boolean(s))
  const needWork = pinned.filter((story) => {
    const state = sharpnessOf(story, now)
    return state === 'untested' || state === 'shaky'
  })
  return {
    total: pinned.length,
    sharp: pinned.filter((story) => sharpnessOf(story, now) === 'sharp').length,
    needWork,
  }
}

/* -------------------------------------------------------------------------- */
/*  Debrief timing                                                             */
/* -------------------------------------------------------------------------- */

/** How long after an interview the memory is worth trusting. */
export const DEBRIEF_WINDOW_DAYS = 3

/**
 * Whether an interview is still worth debriefing. Past, not cancelled, not
 * already done, and recent enough that the recall is worth something — after a
 * few days the answer becomes "it went fine", which teaches nobody anything.
 */
export function debriefIsDue(interview: Interview, now = new Date()): boolean {
  if (interview.debriefedAt) return false
  if (interview.outcome === 'cancelled') return false
  const since = daysSince(interview.scheduledAt, now)
  if (since === null || since < 0) return false
  return since <= DEBRIEF_WINDOW_DAYS
}

/* -------------------------------------------------------------------------- */
/*  Chasing an outcome                                                         */
/* -------------------------------------------------------------------------- */

/** How long after an interview to start asking what came of it. */
export const OUTCOME_AFTER_DAYS = 10
/** How long to leave it alone after you say you are still waiting. */
export const OUTCOME_SNOOZE_DAYS = 7

/**
 * Whether to ask what came of an interview.
 *
 * Without this the analytics that read outcomes stay empty forever: the only
 * place an outcome could be set was an edit dialog nobody opens. It waits until
 * a decision is plausibly back, and once you say you are still waiting it stops
 * asking for a week — a question you cannot answer is just nagging.
 */
export function outcomeIsDue(interview: Interview, now = new Date()): boolean {
  if (interview.outcome !== 'pending') return false
  const since = daysSince(interview.scheduledAt, now)
  if (since === null || since < OUTCOME_AFTER_DAYS) return false
  const asked = daysSince(interview.outcomeAskedAt, now)
  return asked === null || asked >= OUTCOME_SNOOZE_DAYS
}

/* -------------------------------------------------------------------------- */
/*  How long you take                                                          */
/* -------------------------------------------------------------------------- */

/** The band a behavioural answer usually wants to land in, in seconds. */
export const TARGET_MIN_SECONDS = 90
export const TARGET_MAX_SECONDS = 120
/** Past this, an answer is running long whatever else is true of it. */
export const LONG_SECONDS = 180

export type LengthVerdict = 'short' | 'good' | 'long'

/**
 * How long you usually take on a story, from your own runs.
 *
 * The median rather than the mean: one run where you were interrupted should
 * not move the number people plan around. Null until there is anything to say.
 */
export function typicalSeconds(story: Story): number | null {
  const runs = story.recentRuns ?? []
  if (runs.length === 0) return null
  const sorted = runs.map((r) => r.seconds).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0)
  return Math.round(median)
}

export function lengthVerdict(seconds: number): LengthVerdict {
  if (seconds > LONG_SECONDS) return 'long'
  return seconds >= TARGET_MIN_SECONDS ? 'good' : 'short'
}

/** Adds a run, keeping only the most recent few. */
export function appendRun(story: Story, run: RehearsalRun): RehearsalRun[] {
  return [run, ...(story.recentRuns ?? [])].slice(0, MAX_RECENT_RUNS)
}

/** Formats a duration as m:ss. */
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
