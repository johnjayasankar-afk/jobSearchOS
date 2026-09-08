import * as React from 'react'
import { AlertCircle, Check, Ear, PenLine, Play, Plus } from 'lucide-react'
import { Badge, Button } from '@/components/ui/primitives'
import { Tooltip } from '@/components/ui/overlay'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { useBank } from '@/hooks/useBank'
import { buildCoverage, type CoverageState, type ThemeCoverage } from '@/lib/questions'
import { SHARPNESS_META, sharpnessOf } from '@/lib/rehearsal'
import { askedCount, buildDebriefInsights, themeGaps } from '@/lib/debrief'
import { QuestionEditor } from '@/components/settings/QuestionsSection'
import type { StoryTag } from '@/lib/types'
import { cn, pluralize } from '@/lib/utils'

/**
 * The readiness map.
 *
 * The library view answers "what have I written?". This one answers the
 * question that actually decides interviews: "if they ask about X, do I have
 * anything?" Everything here is counted, never scored — a theme is ready
 * because a finished story carries its tag, and the map says so in those words.
 */

const STATE_META: Record<CoverageState, { label: string; hint: string }> = {
  ready: { label: 'Two or more', hint: 'Two or more finished stories carry this theme.' },
  thin: {
    label: 'One deep',
    hint: 'You could answer once. A second question on the same theme would repeat it.',
  },
  uncovered: { label: 'Nothing yet', hint: 'No finished story carries this theme.' },
}

export function Readiness() {
  const ui = useAppUi()
  const workspace = useWorkspace()
  const toast = useToast()
  // A question a real interviewer asked is the best candidate the bank will
  // ever get, so adding it is one tap from where it was recorded.
  const [adding, setAdding] = React.useState<string | null>(null)
  const bank = useBank()
  const coverage = React.useMemo(() => buildCoverage(workspace.stories, bank), [workspace.stories, bank])
  const insights = React.useMemo(
    () => buildDebriefInsights(workspace.interviews, bank),
    [workspace.interviews, bank],
  )
  const gaps = React.useMemo(
    () => themeGaps(insights, workspace.stories).filter((g) => g.unwritten),
    [insights, workspace.stories],
  )

  const answerable = bank.length - coverage.unanswerable.length

  return (
    <div className="px-4 py-5 sm:px-6">
      {/* -- the headline -- */}
      <section className="rounded-xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-[-0.012em] text-fg">
              You could answer {answerable} of {bank.length} questions
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              Counted, not judged: a question is answerable when a finished story carries one of its
              themes.{' '}
              {coverage.singleStory.length > 0 && (
                <>
                  <span className="text-fg">
                    {coverage.singleStory.length}{' '}
                    {pluralize(coverage.singleStory.length, 'theme rests', 'themes rest')} on a
                    single story
                  </span>
                  , so a second question on {coverage.singleStory.length === 1 ? 'it' : 'them'} would
                  repeat the same answer.
                </>
              )}
            </p>
          </div>
          <Button variant="primary" icon={<Ear />} onClick={() => ui.openRehearsal()}>
            Start rehearsing
          </Button>
        </div>

        <CoverageBar coverage={coverage.themes} />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
          <Legend state="ready" count={coverage.readyCount} suffix="with depth" />
          <Legend state="thin" count={coverage.thinCount} suffix="thin" />
          <Legend state="uncovered" count={coverage.uncoveredCount} suffix="empty" />
        </div>
      </section>

      {/* -- the themes -- */}
      <section className="mt-6">
        <h3 className="section-title">By theme</h3>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {[...coverage.themes]
            .sort((a, b) => {
              const order: Record<CoverageState, number> = { uncovered: 0, thin: 1, ready: 2 }
              return order[a.state] - order[b.state] || a.tag.localeCompare(b.tag)
            })
            .map((theme) => (
              <ThemeCard key={theme.tag} theme={theme} />
            ))}
        </div>
      </section>

      {/* -- what has actually been asked -- */}
      {insights.debriefed > 0 && (
        <section className="mt-7">
          <h3 className="section-title">From your own interviews</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Counted from {insights.debriefed} {insights.debriefed === 1 ? 'debrief' : 'debriefs'} you
            wrote.{' '}
            {insights.patternWorthReading
              ? 'Enough to be worth reading as a pattern.'
              : 'Too few to be a pattern yet — this is history, not a trend.'}
          </p>

          {gaps.length > 0 && (
            <div className="mt-3 rounded-lg border border-caution/40 bg-caution-soft/40 px-3.5 py-3">
              <p className="text-base font-medium text-fg">
                Asked about, with nothing written down
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {gaps.map((gap) => (
                  <li key={gap.tag}>
                    <button
                      type="button"
                      onClick={() => ui.openStoryEditor(undefined, { tags: [gap.tag] })}
                      className="inline-flex items-center gap-1.5 rounded border border-caution/40 bg-panel px-1.5 py-px text-2xs font-medium text-fg transition-colors hover:border-caution"
                    >
                      {gap.tag}
                      <span className="tabular-nums text-muted">
                        {gap.asked}×{gap.struggled > 0 ? ` · ${gap.struggled} rough` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.recorded.length > 0 && (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {insights.recorded.slice(0, 8).map((record) => (
                <li
                  key={record.question.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-panel px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-base leading-snug text-fg">
                    {record.question.text}
                  </span>
                  {record.struggled > 0 && (
                    <>
                      <Badge tone="caution">{record.struggled} rough</Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Play />}
                        onClick={() => ui.openRehearsal({ theme: record.question.theme })}
                      >
                        Practise
                      </Button>
                    </>
                  )}
                  <span className="shrink-0 text-2xs tabular-nums text-muted">
                    asked in {record.asked} of {insights.debriefed}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {insights.offBank.length > 0 && (
            <div className="mt-4">
              <p className="text-2xs uppercase tracking-[0.06em] text-faint">
                Asked, but not in the bank
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
                Add one and it counts like any other question — in coverage, in rehearsal, and on the
                next debrief checklist.
              </p>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
                {insights.offBank.slice(0, 6).map((entry) => (
                  <li
                    key={entry.text}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-panel px-3.5 py-2.5"
                  >
                    <span className="min-w-[14rem] flex-1 text-base leading-snug text-fg">
                      {entry.text}
                      {entry.count > 1 && (
                        <span className="ml-1.5 tabular-nums text-faint">×{entry.count}</span>
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus />}
                      className="ml-auto"
                      onClick={() => setAdding(entry.text)}
                    >
                      Add to bank
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <QuestionEditor
        state={adding === null ? null : 'new'}
        initialText={adding ?? undefined}
        onClose={() => setAdding(null)}
        onSaved={() => toast.success('Added to your bank', 'It now counts in coverage and rehearsal.')}
      />

      {/* -- the gaps -- */}
      {coverage.unanswerable.length > 0 && (
        <section className="mt-7">
          <h3 className="section-title">
            Questions you could not answer yet
            <span className="ml-1.5 tabular-nums">{coverage.unanswerable.length}</span>
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            No finished story carries a theme these draw on. That does not mean you have no answer —
            it means the answer is not written down, which is where it goes wrong under pressure.
          </p>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
            {coverage.unanswerable.map((question) => (
              <li
                key={question.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-panel px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base leading-snug text-fg">{question.text}</p>
                  <p className="mt-0.5 text-xs text-faint">{question.listeningFor}</p>
                </div>
                {(() => {
                  const record = askedCount(insights, question.id)
                  return record ? (
                    <Badge tone="caution">asked {record.asked}×</Badge>
                  ) : (
                    <Badge tone="neutral">{question.theme}</Badge>
                  )
                })()}
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<PenLine />}
                  onClick={() => ui.openStoryEditor(undefined, { tags: [question.theme] })}
                >
                  Write one
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

const BAR_TONE: Record<CoverageState, string> = {
  ready: 'bg-positive',
  thin: 'bg-caution',
  uncovered: 'bg-line-strong',
}

const DOT_TONE: Record<CoverageState, string> = {
  ready: 'bg-positive',
  thin: 'bg-caution',
  uncovered: 'bg-line-strong',
}

function CoverageBar({ coverage }: { coverage: ThemeCoverage[] }) {
  return (
    <div className="mt-4 flex gap-0.5" role="img" aria-label={`Coverage across ${coverage.length} themes`}>
      {coverage.map((theme) => (
        <Tooltip key={theme.tag} content={`${theme.tag} — ${STATE_META[theme.state].label}`}>
          <div
            className={cn(
              'h-2 flex-1 rounded-sm transition-opacity hover:opacity-80',
              BAR_TONE[theme.state],
              theme.state === 'uncovered' && 'opacity-50',
            )}
          />
        </Tooltip>
      ))}
    </div>
  )
}

function Legend({ state, count, suffix }: { state: CoverageState; count: number; suffix: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-sm', DOT_TONE[state], state === 'uncovered' && 'opacity-50')} aria-hidden />
      <span className="tabular-nums text-fg">{count}</span>
      <span>{suffix}</span>
    </span>
  )
}

function ThemeCard({ theme }: { theme: ThemeCoverage }) {
  const ui = useAppUi()
  const ready = theme.ready.length
  const drafts = theme.drafts.length

  return (
    <article
      className={cn(
        // min-w-0: a grid item defaults to min-width:auto, so without this the
        // longest story title stretches the whole card past the viewport.
        'flex min-w-0 flex-col rounded-lg border p-3.5',
        theme.state === 'uncovered' ? 'border-dashed border-line bg-transparent' : 'border-line bg-panel',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-md font-medium text-fg">{theme.tag}</h4>
          <p className="mt-0.5 text-xs text-muted">
            {ready > 0
              ? `${ready} finished${drafts > 0 ? `, ${drafts} half-written` : ''}`
              : drafts > 0
                ? `${drafts} half-written`
                : 'No story yet'}
          </p>
        </div>
        <StateChip state={theme.state} />
      </div>

      <p className="mt-2.5 text-xs text-faint">
        {theme.questions.length} {pluralize(theme.questions.length, 'question', 'questions')} draw on this
      </p>

      {ready > 0 && (
        <ul className="mt-2 space-y-1">
          {theme.ready.slice(0, 3).map((story) => {
            const sharp = sharpnessOf(story)
            return (
              <li key={story.id} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => ui.openStoryEditor(story)}
                  className="min-w-0 flex-1 truncate text-left text-muted transition-colors hover:text-fg"
                >
                  {story.title}
                </button>
                <Tooltip content={SHARPNESS_META[sharp].hint}>
                  <span
                    className={cn(
                      'shrink-0 text-2xs',
                      sharp === 'sharp'
                        ? 'text-positive'
                        : sharp === 'shaky'
                          ? 'text-caution'
                          : 'text-faint',
                    )}
                  >
                    {SHARPNESS_META[sharp].label}
                  </span>
                </Tooltip>
              </li>
            )
          })}
          {ready > 3 && <li className="text-2xs text-faint">+{ready - 3} more</li>}
        </ul>
      )}

      <div className="mt-3 flex-1" />

      <div className="flex flex-wrap items-center gap-1.5">
        {ready > 0 && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Play />}
            onClick={() => ui.openRehearsal({ theme: theme.tag as StoryTag })}
          >
            Practise
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          icon={<PenLine />}
          onClick={() => ui.openStoryEditor(undefined, { tags: [theme.tag] })}
        >
          {ready > 0 ? 'Add another' : drafts > 0 ? 'Finish one' : 'Write one'}
        </Button>
      </div>
    </article>
  )
}

function StateChip({ state }: { state: CoverageState }) {
  if (state === 'ready') {
    return (
      <Tooltip content={STATE_META.ready.hint}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-positive-soft text-positive">
          <Check className="h-3 w-3" aria-hidden />
          <span className="sr-only">Ready</span>
        </span>
      </Tooltip>
    )
  }
  return (
    <Tooltip content={STATE_META[state].hint}>
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          state === 'thin' ? 'bg-caution-soft text-caution' : 'bg-subtle text-faint',
        )}
      >
        <AlertCircle className="h-3 w-3" aria-hidden />
        <span className="sr-only">{STATE_META[state].label}</span>
      </span>
    </Tooltip>
  )
}
