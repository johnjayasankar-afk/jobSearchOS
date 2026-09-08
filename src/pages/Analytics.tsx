import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, Ear, Info } from 'lucide-react'
import { PageHeader, SectionHeader, Stat } from '@/components/common'
import { Button, EmptyState, Segmented } from '@/components/ui/primitives'
import { Tooltip } from '@/components/ui/overlay'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { useChartColors } from '@/hooks/useChartColors'
import {
  MIN_SAMPLE,
  bySource,
  byLocation,
  byRoleFamily,
  computeFunnel,
  fitDistribution,
  fitVsResponse,
  hasApplied,
  summarize,
  timeInStage,
  weeklyActivity,
  type Breakdown,
  type Rate,
  interviewRecord,
  preparedVsNot,
  type RoundResult,
} from '@/lib/analytics'
import { cn, pluralize } from '@/lib/utils'

type BreakdownId = 'source' | 'role' | 'location'

export function AnalyticsPage() {
  const ui = useAppUi()
  const workspace = useWorkspace()
  const colors = useChartColors()
  const [breakdown, setBreakdown] = React.useState<BreakdownId>('source')

  const applied = React.useMemo(() => workspace.opportunities.filter(hasApplied), [workspace.opportunities])
  const summary = React.useMemo(() => summarize(workspace.opportunities), [workspace.opportunities])
  const weekly = React.useMemo(
    () => weeklyActivity(workspace.opportunities, workspace.interviews, workspace.contacts, 12),
    [workspace.opportunities, workspace.interviews, workspace.contacts],
  )
  const funnel = React.useMemo(() => computeFunnel(workspace.opportunities), [workspace.opportunities])
  const stageTimes = React.useMemo(() => timeInStage(workspace.opportunities), [workspace.opportunities])
  const fitDist = React.useMemo(
    () => fitDistribution(workspace.opportunities, workspace.profile),
    [workspace.opportunities, workspace.profile],
  )
  const rounds = React.useMemo(() => interviewRecord(workspace.interviews), [workspace.interviews])
  const prepared = React.useMemo(
    () => preparedVsNot(workspace.interviews, workspace.stories),
    [workspace.interviews, workspace.stories],
  )
  // Only worth a panel once both sides exist; otherwise it can only report
  // that it has nothing to report, which is not worth half the page.
  const showPreparedComparison = prepared.preparedDecided > 0 && prepared.unpreparedDecided > 0
  const fitResponse = React.useMemo(
    () => fitVsResponse(workspace.opportunities, workspace.profile),
    [workspace.opportunities, workspace.profile],
  )
  const breakdowns: Record<BreakdownId, Breakdown[]> = React.useMemo(
    () => ({
      source: bySource(workspace.opportunities),
      role: byRoleFamily(workspace.opportunities),
      location: byLocation(workspace.opportunities),
    }),
    [workspace.opportunities],
  )

  if (workspace.opportunities.length === 0) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Analytics" />
        <EmptyState
          icon={<BarChart3 />}
          title="Nothing to measure yet"
          description="Once you have applied to a few roles, this page shows where applications convert, which sources work and how long each stage takes. It only shows metrics that could change what you do next."
          action={
            <Button variant="primary" onClick={() => ui.openAddOpportunity()}>
              Add opportunity
            </Button>
          }
        />
      </div>
    )
  }

  const lowSample = applied.length < MIN_SAMPLE
  const weeklyMax = Math.max(...weekly.map((w) => Math.max(w.applications, w.outreach, w.interviews)), 1)
  const fitBucketMax = Math.max(...fitDist.buckets.map((b) => b.count), 1)

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Analytics"
        description={`${applied.length} ${pluralize(applied.length, 'application')} across ${workspace.opportunities.length} tracked ${pluralize(workspace.opportunities.length, 'opportunity', 'opportunities')}`}
      />

      <div className="space-y-8 px-4 py-5 sm:px-6">
        {lowSample && (
          <div className="flex items-start gap-2.5 rounded-lg border border-line bg-subtle/70 px-3.5 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
            <div>
              <p className="text-base font-medium text-fg">Early days — read these as directional</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">
                You have {applied.length} {pluralize(applied.length, 'application')} recorded. Percentages
                below {MIN_SAMPLE} applications move wildly with a single outcome, so they are shown with
                their counts rather than as conclusions.
              </p>
            </div>
          </div>
        )}

        <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-line pb-6 md:grid-cols-3 xl:grid-cols-5">
          <Stat label="Applications" value={summary.applied} sub={`${summary.active} active in pipeline`} />
          <Stat
            label="Response rate"
            value={formatRate(summary.responseRate)}
            sub={rateSub(summary.responseRate, 'applications')}
          />
          <Stat
            label="Reached interview"
            value={formatRate(summary.screenToInterview)}
            sub={rateSub(summary.screenToInterview, 'screens')}
          />
          <Stat label="Offers" value={summary.offers} sub={formatRate(summary.offerRate) + ' of applications'} />
          <Stat
            label="Median reply time"
            value={summary.medianDaysToFirstResponse === null ? '—' : `${summary.medianDaysToFirstResponse}d`}
            sub={summary.medianDaysToFirstResponse === null ? 'No replies recorded yet' : 'From applying to first reply'}
          />
        </section>

        <section>
          <SectionHeader title="Activity by week" />
          <p className="mt-1 text-sm text-muted">
            Applications sent, interviews held and networking touches logged, over the last 12 weeks.
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekly} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={colors.line} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: colors.faint, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: colors.line }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: colors.faint, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={36}
                  domain={[0, Math.max(1, weeklyMax)]}
                  ticks={integerTicks(weeklyMax)}
                />
                <RTooltip
                  cursor={{ fill: colors.accentSoft }}
                  contentStyle={{
                    background: colors.panel,
                    border: `1px solid ${colors.line}`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: colors.fg,
                  }}
                  labelStyle={{ color: colors.muted, marginBottom: 4 }}
                />
                {/* Animation is off: it adds nothing to a static report, and
                    Recharts' enter animation does not survive StrictMode's
                    double mount. */}
                <Bar
                  dataKey="applications"
                  name="Applications"
                  fill={colors.accent}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={22}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="outreach"
                  name="Networking"
                  fill={colors.line}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={22}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="interviews"
                  name="Interviews"
                  stroke={colors.positive}
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: colors.positive, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Legend
            items={[
              { label: 'Applications', color: colors.accent },
              { label: 'Networking touches', color: colors.line },
              { label: 'Interviews', color: colors.positive },
            ]}
          />
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <SectionHeader title="Funnel" />
            <p className="mt-1 text-sm text-muted">
              How far applications got, counting the furthest stage each one ever reached.
            </p>
            {funnel[0]?.count === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
                No applications submitted yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {funnel.map((step) => {
                  const top = funnel[0]?.count ?? 1
                  const width = top === 0 ? 0 : (step.count / top) * 100
                  return (
                    <li key={step.id}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate text-muted">{step.label}</span>
                        <span className="shrink-0 tabular-nums text-fg">
                          {step.count}
                          {step.conversion && (
                            <span
                              className={cn(
                                'ml-2 text-xs',
                                step.conversion.reliable ? 'text-muted' : 'text-faint',
                              )}
                            >
                              {step.conversion.value === null
                                ? '—'
                                : `${Math.round(step.conversion.value * 100)}%`}
                              {!step.conversion.reliable && step.conversion.denominator > 0 && (
                                <span className="text-faint">
                                  {' '}
                                  ({step.conversion.numerator}/{step.conversion.denominator})
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 h-6 w-full overflow-hidden rounded bg-subtle">
                        <div
                          className="h-full rounded bg-accent/85 transition-[width] duration-500"
                          style={{ width: `${Math.max(width, step.count > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <SectionHeader title="Median time in stage" />
            <p className="mt-1 text-sm text-muted">
              How long opportunities sit in each stage, including the ones still there.
            </p>
            {stageTimes.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
                Not enough stage history yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {stageTimes.map((stage) => {
                  const max = Math.max(...stageTimes.map((s) => s.medianDays ?? 0), 1)
                  return (
                    <li key={stage.stage} className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-3">
                      <span className="truncate text-sm text-muted">{stage.label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-info"
                          style={{ width: `${((stage.medianDays ?? 0) / max) * 100}%` }}
                        />
                      </span>
                      <Tooltip content={`${stage.samples} ${pluralize(stage.samples, 'observation')}`}>
                        <span className="cursor-default text-right text-sm tabular-nums text-fg">
                          {stage.medianDays === null ? '—' : `${Math.round(stage.medianDays)}d`}
                        </span>
                      </Tooltip>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <section>
          <SectionHeader
            title="Where applications come from"
            action={
              <Segmented<BreakdownId>
                ariaLabel="Breakdown dimension"
                size="sm"
                value={breakdown}
                onChange={setBreakdown}
                options={[
                  { value: 'source', label: 'Source' },
                  { value: 'role', label: 'Role' },
                  { value: 'location', label: 'Location' },
                ]}
              />
            }
          />
          <BreakdownTable rows={breakdowns[breakdown]} />
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <SectionHeader title="Fit score distribution" />
            {fitDist.scored === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
                Fill in your Master Profile in Settings to score opportunities and see this distribution.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">
                  {fitDist.scored} scored
                  {fitDist.unscored > 0 && ` · ${fitDist.unscored} could not be scored`}
                </p>
                <div className="mt-4 h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fitDist.buckets} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
                      <CartesianGrid stroke={colors.line} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: colors.faint, fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: colors.line }}
                      />
                      <YAxis
                        tick={{ fill: colors.faint, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={34}
                        domain={[0, Math.max(1, fitBucketMax)]}
                        ticks={integerTicks(fitBucketMax)}
                      />
                      <RTooltip
                        cursor={{ fill: colors.accentSoft }}
                        contentStyle={{
                          background: colors.panel,
                          border: `1px solid ${colors.line}`,
                          borderRadius: 8,
                          fontSize: 12,
                          color: colors.fg,
                        }}
                      />
                      <Bar
                        dataKey="count"
                        name="Opportunities"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={44}
                        isAnimationActive={false}
                      >
                        {fitDist.buckets.map((bucket, i) => (
                          <Cell
                            key={bucket.label}
                            fill={[colors.critical, colors.caution, colors.info, colors.accent, colors.positive][i]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </section>

          <section>
            <SectionHeader title="Does fit predict replies?" />
            {fitResponse.respondedCount + fitResponse.noResponseCount === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
                No scored applications yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <ComparisonBar
                  label="Applications that got a reply"
                  value={fitResponse.respondedAverage}
                  count={fitResponse.respondedCount}
                  color={colors.positive}
                />
                <ComparisonBar
                  label="Applications with no reply"
                  value={fitResponse.noResponseAverage}
                  count={fitResponse.noResponseCount}
                  color={colors.line}
                />
                <p className="text-sm leading-relaxed text-muted">
                  {fitResponse.reliable
                    ? 'Average fit score of each group. A meaningful gap suggests your fit model is picking up something real.'
                    : `Too few applications in each group to compare — this needs at least ${MIN_SAMPLE} on both sides before the difference means anything.`}
                </p>
              </div>
            )}
          </section>
        </div>

        <div
          className={cn(
            'mt-8 grid gap-8',
            showPreparedComparison && 'lg:grid-cols-2',
          )}
        >
          <section>
            <SectionHeader title="Which round loses it" />
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Of the interviews you have sat, which kind you get past. Only the ones with a result
              are counted — a round still waiting is not evidence either way.
            </p>
            {rounds.rounds.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
                No interviews have happened yet.
              </p>
            ) : (
              <>
                <ul
                  className={cn(
                    'mt-4 grid gap-x-8 gap-y-3',
                    !showPreparedComparison && rounds.rounds.length > 3 && 'sm:grid-cols-2',
                  )}
                >
                  {rounds.rounds.map((round) => (
                    <RoundRow key={round.type} round={round} />
                  ))}
                </ul>
                {rounds.thin ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {rounds.decided === 0
                      ? 'None of these have a result recorded yet, so there is nothing to read here. Setting an outcome on a past interview is what fills this in.'
                      : `Only ${rounds.decided} ${rounds.decided === 1 ? 'interview has' : 'interviews have'} a result so far — too few to call any round a weakness.`}
                  </p>
                ) : rounds.weakest ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-caution/40 bg-caution-soft/40 px-3.5 py-3">
                    <p className="min-w-[14rem] flex-1 text-sm leading-relaxed text-fg">
                      <span className="font-medium">{rounds.weakest.label}</span> has ended it{' '}
                      {rounds.weakest.rejected} times — more than any other round.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Ear />}
                      className="ml-auto"
                      onClick={() => ui.openRehearsal({ format: rounds.weakest?.type })}
                    >
                      Practise this round
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    No round stands out as a weakness yet.
                  </p>
                )}
              </>
            )}
          </section>

          {showPreparedComparison && (
          <section>
            <SectionHeader title="Did preparation show?" />
            {(
              <div className="mt-4 space-y-3">
                <ComparisonBar
                  label="Rehearsed beforehand"
                  value={
                    prepared.preparedDecided > 0
                      ? (prepared.preparedAdvanced / prepared.preparedDecided) * 100
                      : null
                  }
                  count={prepared.preparedDecided}
                  color={colors.positive}
                  suffix="%"
                />
                <ComparisonBar
                  label="Not rehearsed"
                  value={
                    prepared.unpreparedDecided > 0
                      ? (prepared.unpreparedAdvanced / prepared.unpreparedDecided) * 100
                      : null
                  }
                  count={prepared.unpreparedDecided}
                  color={colors.line}
                  suffix="%"
                />
                <p className="text-sm leading-relaxed text-muted">
                  {prepared.reliable
                    ? 'How often each group advanced. A gap is worth noticing, though plenty else differs between these interviews.'
                    : `Far too few to compare — this would need at least ${MIN_SAMPLE} decided interviews on both sides, and even then it would not be a controlled experiment.`}
                </p>
              </div>
            )}
          </section>
          )}
        </div>
      </div>
    </div>
  )
}

function RoundRow({ round }: { round: RoundResult }) {
  const total = Math.max(1, round.held)
  const segments = [
    { key: 'advanced', n: round.advanced, className: 'bg-positive' },
    { key: 'rejected', n: round.rejected, className: 'bg-critical' },
    { key: 'undecided', n: round.undecided, className: 'bg-line-strong' },
  ].filter((seg) => seg.n > 0)

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-base text-fg">{round.label}</span>
        <span className="shrink-0 text-sm tabular-nums text-muted">
          {round.conversion.denominator > 0 ? (
            <>
              <span className="text-fg">{formatRate(round.conversion)}</span>{' '}
              <span className="text-faint">
                {round.advanced}/{round.conversion.denominator} advanced
              </span>
            </>
          ) : (
            <span className="text-faint">no result yet</span>
          )}
        </span>
      </div>
      <div className="mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full" role="presentation">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', seg.className)}
            style={{ width: `${(seg.n / total) * 100}%` }}
          />
        ))}
      </div>
    </li>
  )
}

/* -------------------------------- helpers --------------------------------- */

/**
 * Whole-number ticks for a count axis. Recharts otherwise picks fractional
 * ticks and rounds them for display, which prints the same label twice.
 */
function integerTicks(max: number): number[] {
  const top = Math.max(1, Math.ceil(max))
  const step = top <= 6 ? 1 : Math.ceil(top / 5)
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  if (ticks[ticks.length - 1] !== top) ticks.push(top)
  return ticks
}

function formatRate(rate: Rate): string {
  return rate.value === null ? '—' : `${Math.round(rate.value * 100)}%`
}

function rateSub(rate: Rate, unit: string): string {
  if (rate.denominator === 0) return `No ${unit} yet`
  return rate.reliable
    ? `${rate.numerator} of ${rate.denominator} ${unit}`
    : `${rate.numerator} of ${rate.denominator} — small sample`
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 rounded-sm" style={{ background: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function ComparisonBar({
  label,
  value,
  count,
  color,
  suffix = '',
}: {
  label: string
  value: number | null
  count: number
  color: string
  suffix?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate text-muted">{label}</span>
        <span className="shrink-0 tabular-nums text-fg">
          {value === null ? '—' : `${Math.round(value)}${suffix}`}
          <span className="ml-2 text-xs text-faint">
            n={count}
          </span>
        </span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-subtle">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${value ?? 0}%`, background: color }}
        />
      </div>
    </div>
  )
}

function BreakdownTable({ rows }: { rows: Breakdown[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
        No applications recorded with this information yet.
      </p>
    )
  }
  const max = Math.max(...rows.map((r) => r.total), 1)

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="pb-2 text-2xs font-semibold uppercase tracking-[0.05em] text-faint">
              Name
            </th>
            <th scope="col" className="pb-2 text-2xs font-semibold uppercase tracking-[0.05em] text-faint">
              Applications
            </th>
            <th scope="col" className="pb-2 text-right text-2xs font-semibold uppercase tracking-[0.05em] text-faint">
              Replies
            </th>
            <th scope="col" className="pb-2 text-right text-2xs font-semibold uppercase tracking-[0.05em] text-faint">
              Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((row) => (
            <tr key={row.key} className="border-b border-line/70">
              <td className="max-w-[14rem] truncate py-2 pr-3 text-base text-fg" title={row.key}>
                {row.key}
              </td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-24 overflow-hidden rounded-full bg-subtle" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-accent/80"
                      style={{ width: `${(row.total / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-sm tabular-nums text-muted">{row.total}</span>
                </div>
              </td>
              <td className="py-2 text-right text-sm tabular-nums text-muted">{row.responded}</td>
              <td className="py-2 text-right text-sm tabular-nums">
                <span className={row.responseRate.reliable ? 'text-fg' : 'text-faint'}>
                  {formatRate(row.responseRate)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some((r) => !r.responseRate.reliable) && (
        <p className="mt-2 text-xs text-faint">
          Rates in grey come from fewer than {MIN_SAMPLE} applications.
        </p>
      )}
    </div>
  )
}
