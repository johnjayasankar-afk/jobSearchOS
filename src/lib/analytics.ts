/**
 * Search analytics.
 *
 * Two rules govern this module:
 *  1. Only compute metrics that could change what the user does next.
 *  2. Never imply significance that the sample does not support. Every rate
 *     carries its denominator, and rates below `MIN_SAMPLE` are returned with
 *     `reliable: false` so the UI can present them as directional only.
 */
import {
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_META,
  STAGE_META,
  type Contact,
  type Interview,
  type InterviewType,
  type MasterProfile,
  type Opportunity,
  type Stage,
  type Story,
} from './types'
import { computeFit } from './fit'
import { average, parseAnyDate, startOfWeek, toDateOnly } from './utils'

/** Below this many observations a percentage is directional, not evidence. */
export const MIN_SAMPLE = 8

export interface Rate {
  numerator: number
  denominator: number
  /** null when the denominator is zero. */
  value: number | null
  reliable: boolean
}

export function rate(numerator: number, denominator: number): Rate {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : numerator / denominator,
    reliable: denominator >= MIN_SAMPLE,
  }
}

/** Highest stage an opportunity ever reached, from its recorded history. */
export function furthestStage(o: Opportunity): Stage {
  const history = o.stageHistory?.length ? o.stageHistory : [{ stage: o.stage, at: o.createdAt }]
  let best: Stage = history[0]?.stage ?? o.stage
  for (const visit of history) {
    if (STAGE_META[visit.stage].order > STAGE_META[best].order) best = visit.stage
  }
  // Terminal stages don't imply progress; fall back to the rejection stage.
  if (!STAGE_META[best].active && best !== 'accepted') {
    const priorActive = history
      .map((v) => v.stage)
      .filter((s) => STAGE_META[s].active)
      .sort((a, b) => STAGE_META[b].order - STAGE_META[a].order)[0]
    const declared = o.rejection?.stage
    const candidates = [priorActive, declared].filter((s): s is Stage => Boolean(s))
    if (candidates.length > 0) {
      best = candidates.sort((a, b) => STAGE_META[b].order - STAGE_META[a].order)[0] as Stage
    }
  }
  return best
}

export function hasApplied(o: Opportunity): boolean {
  if (o.dateApplied) return true
  return STAGE_META[furthestStage(o)].order >= STAGE_META.applied.order
}

/** True when the employer responded in any way: advanced the process or rejected. */
export function gotResponse(o: Opportunity): boolean {
  if (!hasApplied(o)) return false
  if (STAGE_META[furthestStage(o)].order >= STAGE_META.recruiter_screen.order) return true
  return o.stage === 'rejected'
}

/* -------------------------------------------------------------------------- */
/*  Weekly activity                                                            */
/* -------------------------------------------------------------------------- */

export interface WeekBucket {
  weekStart: string
  label: string
  applications: number
  interviews: number
  outreach: number
  added: number
}

export function weeklyActivity(
  opportunities: Opportunity[],
  interviews: Interview[],
  contacts: Contact[],
  weeks = 12,
): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>()
  const start = startOfWeek(new Date())
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(start)
    d.setDate(d.getDate() - i * 7)
    const key = toDateOnly(d)
    buckets.set(key, {
      weekStart: key,
      label: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d),
      applications: 0,
      interviews: 0,
      outreach: 0,
      added: 0,
    })
  }

  const bump = (value: string | undefined, field: keyof Omit<WeekBucket, 'weekStart' | 'label'>) => {
    const d = parseAnyDate(value)
    if (!d) return
    const key = toDateOnly(startOfWeek(d))
    const bucket = buckets.get(key)
    if (bucket) bucket[field] += 1
  }

  for (const o of opportunities) {
    bump(o.dateApplied, 'applications')
    bump(o.dateDiscovered, 'added')
  }
  for (const iv of interviews) bump(iv.scheduledAt, 'interviews')
  for (const c of contacts) bump(c.lastContactDate, 'outreach')

  return [...buckets.values()]
}

/* -------------------------------------------------------------------------- */
/*  Momentum (Today)                                                           */
/* -------------------------------------------------------------------------- */

export interface MomentumMetric {
  id: string
  label: string
  value: number
  /** Previous period value for a plain delta — no trend lines, no drama. */
  previous: number
  target?: number
  suffix?: string
}

export interface Momentum {
  metrics: MomentumMetric[]
  responseRate: Rate
}

export function computeMomentum(
  opportunities: Opportunity[],
  interviews: Interview[],
  contacts: Contact[],
  targets: { applications: number; networking: number },
): Momentum {
  const thisWeek = startOfWeek(new Date())
  const lastWeek = new Date(thisWeek)
  lastWeek.setDate(lastWeek.getDate() - 7)

  const inWeek = (value: string | undefined, weekStart: Date) => {
    const d = parseAnyDate(value)
    if (!d) return false
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 7)
    return d >= weekStart && d < end
  }

  const applications = opportunities.filter((o) => inWeek(o.dateApplied, thisWeek)).length
  const applicationsPrev = opportunities.filter((o) => inWeek(o.dateApplied, lastWeek)).length
  const ivs = interviews.filter((i) => inWeek(i.scheduledAt, thisWeek)).length
  const ivsPrev = interviews.filter((i) => inWeek(i.scheduledAt, lastWeek)).length
  const touches = contacts.filter((c) => inWeek(c.lastContactDate, thisWeek)).length
  const touchesPrev = contacts.filter((c) => inWeek(c.lastContactDate, lastWeek)).length

  // Response rate over applications from the last 90 days, so it reflects the
  // current search rather than a stale historical average.
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const recentApps = opportunities.filter((o) => {
    const d = parseAnyDate(o.dateApplied)
    return Boolean(d && d >= cutoff)
  })
  const responded = recentApps.filter(gotResponse).length

  return {
    metrics: [
      { id: 'applications', label: 'Applications', value: applications, previous: applicationsPrev, target: targets.applications },
      { id: 'interviews', label: 'Interviews', value: ivs, previous: ivsPrev },
      { id: 'outreach', label: 'Networking touches', value: touches, previous: touchesPrev, target: targets.networking },
    ],
    responseRate: rate(responded, recentApps.length),
  }
}

/* -------------------------------------------------------------------------- */
/*  Funnel                                                                     */
/* -------------------------------------------------------------------------- */

export interface FunnelStep {
  id: string
  label: string
  count: number
  /** Conversion from the previous step. */
  conversion: Rate | null
}

const FUNNEL_STAGES: Array<{ id: string; label: string; stage: Stage }> = [
  { id: 'applied', label: 'Applied', stage: 'applied' },
  { id: 'screen', label: 'Recruiter screen', stage: 'recruiter_screen' },
  { id: 'interview', label: 'Hiring manager +', stage: 'hiring_manager' },
  { id: 'final', label: 'Final round', stage: 'final_round' },
  { id: 'offer', label: 'Offer', stage: 'offer' },
]

export function computeFunnel(opportunities: Opportunity[]): FunnelStep[] {
  const reached = opportunities.map((o) => STAGE_META[furthestStage(o)].order)
  const counts = FUNNEL_STAGES.map(({ stage }) => reached.filter((r) => r >= STAGE_META[stage].order).length)
  return FUNNEL_STAGES.map((step, i) => ({
    id: step.id,
    label: step.label,
    count: counts[i] ?? 0,
    conversion: i === 0 ? null : rate(counts[i] ?? 0, counts[i - 1] ?? 0),
  }))
}

/* -------------------------------------------------------------------------- */
/*  Breakdowns                                                                 */
/* -------------------------------------------------------------------------- */

export interface Breakdown {
  key: string
  total: number
  responded: number
  responseRate: Rate
}

function breakdown(
  opportunities: Opportunity[],
  keyOf: (o: Opportunity) => string | undefined,
): Breakdown[] {
  const map = new Map<string, { total: number; responded: number }>()
  for (const o of opportunities) {
    const key = keyOf(o)?.trim()
    if (!key) continue
    const entry = map.get(key) ?? { total: 0, responded: 0 }
    entry.total += 1
    if (gotResponse(o)) entry.responded += 1
    map.set(key, entry)
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, total: v.total, responded: v.responded, responseRate: rate(v.responded, v.total) }))
    .sort((a, b) => b.total - a.total)
}

export function bySource(opportunities: Opportunity[]): Breakdown[] {
  return breakdown(opportunities.filter(hasApplied), (o) => o.source ?? 'Unspecified')
}

export function byRoleFamily(opportunities: Opportunity[]): Breakdown[] {
  return breakdown(opportunities.filter(hasApplied), (o) => normalizeRoleFamily(o.role))
}

export function byLocation(opportunities: Opportunity[]): Breakdown[] {
  return breakdown(opportunities.filter(hasApplied), (o) =>
    o.workArrangement === 'remote' ? 'Remote' : (o.location?.split(',')[0]?.trim() || 'Unspecified'),
  )
}

/** Collapses "Senior Product Manager, Payments" to "Product Manager". */
export function normalizeRoleFamily(role: string): string {
  const cleaned = role
    .replace(/[,–—-].*$/, '')
    .replace(/\b(senior|sr\.?|staff|principal|lead|junior|jr\.?|associate|i{1,3}|iv|v)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || role
}

/* -------------------------------------------------------------------------- */
/*  Time in stage                                                              */
/* -------------------------------------------------------------------------- */

export interface StageDuration {
  stage: Stage
  label: string
  medianDays: number | null
  samples: number
}

export function timeInStage(opportunities: Opportunity[]): StageDuration[] {
  const durations = new Map<Stage, number[]>()
  for (const o of opportunities) {
    const history = o.stageHistory ?? []
    for (let i = 0; i < history.length; i++) {
      const visit = history[i]
      if (!visit) continue
      const nextVisit = history[i + 1]
      const start = parseAnyDate(visit.at)
      const end = nextVisit ? parseAnyDate(nextVisit.at) : new Date()
      if (!start || !end) continue
      const days = (end.getTime() - start.getTime()) / 86_400_000
      if (days < 0 || days > 400) continue
      const list = durations.get(visit.stage) ?? []
      list.push(days)
      durations.set(visit.stage, list)
    }
  }
  return [...durations.entries()]
    .filter(([stage]) => STAGE_META[stage].active)
    .map(([stage, list]) => ({
      stage,
      label: STAGE_META[stage].label,
      medianDays: list.length === 0 ? null : median(list),
      samples: list.length,
    }))
    .sort((a, b) => STAGE_META[a.stage].order - STAGE_META[b.stage].order)
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2 : (s[mid] ?? 0)
}

/* -------------------------------------------------------------------------- */
/*  Fit distribution and fit-vs-response                                       */
/* -------------------------------------------------------------------------- */

export interface FitBucket {
  label: string
  range: [number, number]
  count: number
  responded: number
}

export function fitDistribution(
  opportunities: Opportunity[],
  profile: MasterProfile | null,
): { buckets: FitBucket[]; scored: number; unscored: number } {
  const buckets: FitBucket[] = [
    { label: '0–39', range: [0, 39], count: 0, responded: 0 },
    { label: '40–54', range: [40, 54], count: 0, responded: 0 },
    { label: '55–69', range: [55, 69], count: 0, responded: 0 },
    { label: '70–84', range: [70, 84], count: 0, responded: 0 },
    { label: '85–100', range: [85, 100], count: 0, responded: 0 },
  ]
  let scored = 0
  let unscored = 0
  for (const o of opportunities) {
    const { score } = computeFit(o, profile)
    if (score === null) {
      unscored += 1
      continue
    }
    scored += 1
    const bucket = buckets.find((b) => score >= b.range[0] && score <= b.range[1])
    if (bucket) {
      bucket.count += 1
      if (gotResponse(o)) bucket.responded += 1
    }
  }
  return { buckets, scored, unscored }
}

export interface FitVsResponse {
  respondedAverage: number | null
  noResponseAverage: number | null
  respondedCount: number
  noResponseCount: number
  reliable: boolean
}

export function fitVsResponse(
  opportunities: Opportunity[],
  profile: MasterProfile | null,
): FitVsResponse {
  const applied = opportunities.filter(hasApplied)
  const withScores = applied
    .map((o) => ({ o, score: computeFit(o, profile).score }))
    .filter((x): x is { o: Opportunity; score: number } => x.score !== null)
  const responded = withScores.filter((x) => gotResponse(x.o))
  const not = withScores.filter((x) => !gotResponse(x.o))
  return {
    respondedAverage: average(responded.map((x) => x.score)),
    noResponseAverage: average(not.map((x) => x.score)),
    respondedCount: responded.length,
    noResponseCount: not.length,
    reliable: responded.length >= MIN_SAMPLE && not.length >= MIN_SAMPLE,
  }
}

/* -------------------------------------------------------------------------- */
/*  Networking vs interviews                                                   */
/* -------------------------------------------------------------------------- */

export interface AnalyticsSummary {
  totalOpportunities: number
  active: number
  applied: number
  interviewing: number
  offers: number
  rejected: number
  responseRate: Rate
  screenToInterview: Rate
  offerRate: Rate
  medianDaysToFirstResponse: number | null
}

export function summarize(opportunities: Opportunity[]): AnalyticsSummary {
  const applied = opportunities.filter(hasApplied)
  const responded = applied.filter(gotResponse)
  const reachedScreen = applied.filter(
    (o) => STAGE_META[furthestStage(o)].order >= STAGE_META.recruiter_screen.order,
  )
  const reachedInterview = applied.filter(
    (o) => STAGE_META[furthestStage(o)].order >= STAGE_META.hiring_manager.order,
  )
  const offers = applied.filter((o) => STAGE_META[furthestStage(o)].order >= STAGE_META.offer.order)

  const responseDays: number[] = []
  for (const o of applied) {
    const from = parseAnyDate(o.dateApplied)
    if (!from) continue
    const firstResponse = (o.stageHistory ?? []).find(
      (v) => STAGE_META[v.stage].order >= STAGE_META.recruiter_screen.order || v.stage === 'rejected',
    )
    const to = parseAnyDate(firstResponse?.at)
    if (!to) continue
    const days = (to.getTime() - from.getTime()) / 86_400_000
    if (days >= 0 && days < 400) responseDays.push(days)
  }

  return {
    totalOpportunities: opportunities.length,
    active: opportunities.filter((o) => !o.archivedAt && STAGE_META[o.stage].active).length,
    applied: applied.length,
    interviewing: opportunities.filter((o) => STAGE_META[o.stage].group === 'interviewing').length,
    offers: offers.length,
    rejected: opportunities.filter((o) => o.stage === 'rejected').length,
    responseRate: rate(responded.length, applied.length),
    screenToInterview: rate(reachedInterview.length, reachedScreen.length),
    offerRate: rate(offers.length, applied.length),
    medianDaysToFirstResponse: responseDays.length === 0 ? null : Math.round(median(responseDays)),
  }
}

/* -------------------------------------------------------------------------- */
/*  Which round loses it                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The question a tracker never answers: of the interviews you have actually
 * sat, which kind do you get past and which kind ends it?
 *
 * Only decided interviews count. One still waiting on a result is not evidence
 * of anything, and folding it into a rate would quietly make every number look
 * worse than it is.
 */
export interface RoundResult {
  type: InterviewType
  label: string
  /** Interviews of this type that have happened. */
  held: number
  advanced: number
  rejected: number
  /** Held but with no result recorded either way. */
  undecided: number
  /** advanced / (advanced + rejected). */
  conversion: Rate
}

export interface InterviewRecord {
  rounds: RoundResult[]
  held: number
  decided: number
  /** The round with the most rejections, once there are enough to mean it. */
  weakest: RoundResult | null
  /** True when the whole record is too thin to read anything into. */
  thin: boolean
}

function hasHappened(interview: Interview, now: Date): boolean {
  if (interview.outcome === 'cancelled') return false
  const at = parseAnyDate(interview.scheduledAt)
  return Boolean(at && at.getTime() <= now.getTime())
}

export function interviewRecord(interviews: Interview[], now = new Date()): InterviewRecord {
  const held = interviews.filter((iv) => hasHappened(iv, now))

  const rounds: RoundResult[] = INTERVIEW_TYPES.map((type) => {
    const mine = held.filter((iv) => iv.type === type)
    const advanced = mine.filter((iv) => iv.outcome === 'advanced').length
    const rejected = mine.filter((iv) => iv.outcome === 'rejected').length
    return {
      type,
      label: INTERVIEW_TYPE_META[type].label,
      held: mine.length,
      advanced,
      rejected,
      undecided: mine.length - advanced - rejected,
      conversion: rate(advanced, advanced + rejected),
    }
  }).filter((round) => round.held > 0)

  const decided = rounds.reduce((sum, r) => sum + r.advanced + r.rejected, 0)

  // Naming a weakest round off one rejection would be worse than saying
  // nothing, so it needs at least two and something to compare against.
  const candidates = rounds.filter((r) => r.rejected >= 2)
  const weakest =
    candidates.length > 0
      ? ([...candidates].sort(
          (a, b) => b.rejected - a.rejected || (a.conversion.value ?? 1) - (b.conversion.value ?? 1),
        )[0] ?? null)
      : null

  return {
    rounds: rounds.sort((a, b) => b.held - a.held || a.label.localeCompare(b.label)),
    held: held.length,
    decided,
    weakest,
    thin: decided < 4,
  }
}

/* -------------------------------------------------------------------------- */
/*  Did preparation show?                                                      */
/* -------------------------------------------------------------------------- */

export interface PreparedVsNot {
  preparedAdvanced: number
  preparedDecided: number
  unpreparedAdvanced: number
  unpreparedDecided: number
  reliable: boolean
}

/**
 * Advance rates for interviews you had rehearsed against those you had not.
 *
 * This will almost never reach a sample worth trusting, and the honest thing is
 * to show the counts and say so rather than dress two interviews up as a
 * finding. `reliable` is the caller's cue to refuse to draw a line.
 */
export function preparedVsNot(
  interviews: Interview[],
  stories: Story[],
  now = new Date(),
): PreparedVsNot {
  const byId = new Map(stories.map((s) => [s.id, s]))
  const decided = interviews.filter(
    (iv) => hasHappened(iv, now) && (iv.outcome === 'advanced' || iv.outcome === 'rejected'),
  )

  // "Prepared" means at least one story pinned to it had been rehearsed before
  // the interview happened — not merely that it has been rehearsed since.
  const wasPrepared = (iv: Interview): boolean => {
    const at = parseAnyDate(iv.scheduledAt)?.getTime() ?? 0
    return iv.storyIds.some((id) => {
      const story = byId.get(id)
      if (!story?.rehearsalCount || !story.lastRehearsedAt) return false
      const rehearsed = parseAnyDate(story.lastRehearsedAt)?.getTime()
      return Boolean(rehearsed && rehearsed <= at)
    })
  }

  const prepared = decided.filter(wasPrepared)
  const not = decided.filter((iv) => !wasPrepared(iv))

  return {
    preparedAdvanced: prepared.filter((iv) => iv.outcome === 'advanced').length,
    preparedDecided: prepared.length,
    unpreparedAdvanced: not.filter((iv) => iv.outcome === 'advanced').length,
    unpreparedDecided: not.length,
    reliable: prepared.length >= MIN_SAMPLE && not.length >= MIN_SAMPLE,
  }
}
