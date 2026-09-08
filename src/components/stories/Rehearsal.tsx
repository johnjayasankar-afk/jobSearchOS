import * as React from 'react'
import {
  ArrowRight,
  Check,
  Ear,
  Eye,
  EyeOff,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkle,
  X,
} from 'lucide-react'
import * as RDialog from '@radix-ui/react-dialog'
import { Badge, Button, IconButton, Kbd } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { useBank } from '@/hooks/useBank'
import { recordRehearsal } from '@/lib/repo'
import { buildDrill, type DrillItem } from '@/lib/questions'
import { buildDebriefInsights } from '@/lib/debrief'
import { INTERVIEW_TYPE_META, type RehearsalRating, type Story } from '@/lib/types'
import {
  LONG_SECONDS,
  TARGET_MAX_SECONDS,
  TARGET_MIN_SECONDS,
  formatSeconds,
  lengthVerdict,
  typicalSeconds,
} from '@/lib/rehearsal'
import { cn } from '@/lib/utils'

/**
 * The rehearsal room.
 *
 * A story bank is a filing cabinet until you have said the answer out loud, so
 * this does one thing: shows a question, starts a clock, and keeps your notes
 * hidden until you ask for them. Nothing here scores the answer — only you can
 * do that, and the verdict you give is what the rest of the app trusts.
 */


type Phase = 'ready' | 'speaking' | 'verdict' | 'done'

export function Rehearsal() {
  const ui = useAppUi()
  const workspace = useWorkspace()
  const toast = useToast()
  const bank = useBank()

  const interview = workspace.interviews.find((iv) => iv.id === ui.rehearsal.interviewId)
  const opportunity = workspace.opportunities.find((o) => o.id === interview?.opportunityId)

  // The set is fixed when the room opens; re-deriving it while you practise
  // would reshuffle the questions under you as ratings land.
  const [items, setItems] = React.useState<DrillItem[]>([])
  const [index, setIndex] = React.useState(0)
  const [phase, setPhase] = React.useState<Phase>('ready')
  const [seconds, setSeconds] = React.useState(0)
  const startedAt = React.useRef<number | null>(null)
  const [peeking, setPeeking] = React.useState(false)
  const [log, setLog] = React.useState<Array<{ story: Story; rating: RehearsalRating }>>([])

  const open = ui.rehearsal.open

  React.useEffect(() => {
    if (!open) return
    const { interviewId, theme, storyId, format } = ui.rehearsal
    const scopedStories = storyId
      ? workspace.stories.filter((s) => s.id === storyId)
      : workspace.stories
    const insights = buildDebriefInsights(workspace.interviews, bank)
    const built = buildDrill(scopedStories, {
      bank,
      formats: format ? [format] : interviewId && interview ? [interview.type] : undefined,
      themes: theme ? [theme] : undefined,
      limit: storyId ? 4 : 8,
      struggled: insights.weakest.map((r) => r.question.id),
    })
    // Practising one story means practising questions it can actually answer.
    setItems(storyId ? built.filter((item) => item.story) : built)
    setIndex(0)
    setPhase('ready')
    setSeconds(0)
    setPeeking(false)
    setLog([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ui.rehearsal.interviewId, ui.rehearsal.theme, ui.rehearsal.storyId, ui.rehearsal.format])

  /* -- the clock -- */
  // Elapsed time is derived from a timestamp rather than counted in ticks:
  // browsers throttle timers in a background tab, and a clock that quietly
  // loses seconds is worse than no clock at all.
  React.useEffect(() => {
    if (phase !== 'speaking') return
    const tick = () => {
      if (startedAt.current !== null) {
        setSeconds(Math.floor((Date.now() - startedAt.current) / 1000))
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    const onVisible = () => tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [phase])

  const current = items[index]
  const atEnd = index >= items.length - 1

  const start = React.useCallback(() => {
    startedAt.current = Date.now()
    setSeconds(0)
    setPeeking(false)
    setPhase('speaking')
  }, [])

  const stop = React.useCallback(() => {
    if (startedAt.current !== null) {
      setSeconds(Math.floor((Date.now() - startedAt.current) / 1000))
    }
    // Reveal the notes on stopping. Before you answer they are a crutch; the
    // moment after, they are the only way to know what you left out.
    setPeeking(true)
    setPhase('verdict')
  }, [])

  const advance = React.useCallback(() => {
    if (atEnd) {
      setPhase('done')
      return
    }
    setIndex((i) => i + 1)
    startedAt.current = null
    setSeconds(0)
    setPeeking(false)
    setPhase('ready')
  }, [atEnd])

  const rate = React.useCallback(
    async (rating: RehearsalRating) => {
      const story = current?.story
      if (story) {
        const { undo } = await recordRehearsal(story.id, rating, seconds)
        setLog((l) => [...l, { story, rating }])
        toast.undoable(
          rating === 'solid' ? 'Marked as solid' : 'Marked as needing work',
          undo,
          story.title,
        )
      }
      advance()
    },
    [advance, current, toast, seconds],
  )

  /* -- keyboard -- */
  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault()
        if (phase === 'ready') start()
        else if (phase === 'speaking') stop()
        return
      }
      if (event.key.toLowerCase() === 'p' && (phase === 'speaking' || phase === 'ready')) {
        event.preventDefault()
        setPeeking((p) => !p)
        return
      }
      if (event.key.toLowerCase() === 's' && phase !== 'done') {
        event.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, phase, start, stop, advance])

  const close = () => ui.closeRehearsal()

  const scopeLabel = interview
    ? `${INTERVIEW_TYPE_META[interview.type].label}${opportunity ? ` · ${opportunity.company}` : ''}`
    : ui.rehearsal.format
      ? `${INTERVIEW_TYPE_META[ui.rehearsal.format].label} questions`
      : ui.rehearsal.theme
      ? `${ui.rehearsal.theme} questions`
      : ui.rehearsal.storyId
        ? 'One story'
        : 'Mixed questions'

  return (
    <RDialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[hsl(var(--shadow)/0.42)] backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <RDialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            ;(event.currentTarget as HTMLElement).focus({ preventScroll: true })
          }}
          tabIndex={-1}
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-bg outline-none sm:inset-4 sm:rounded-2xl sm:border sm:border-line sm:shadow-xl',
            'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
          )}
        >
          <RDialog.Title className="sr-only">Rehearsal</RDialog.Title>
          <RDialog.Description className="sr-only">
            Practise answering interview questions out loud against a timer. Your notes stay hidden
            until you reveal them.
          </RDialog.Description>

          <Header
            scopeLabel={scopeLabel}
            index={index}
            total={items.length}
            phase={phase}
            onClose={close}
          />

          {items.length === 0 ? (
            <EmptyRoom onClose={close} />
          ) : phase === 'done' ? (
            <Summary log={log} planned={items.length} onClose={close} onAgain={() => {
              setIndex(0)
              setPhase('ready')
              setSeconds(0)
              setLog([])
            }} />
          ) : current ? (
            <Room
              item={current}
              phase={phase}
              seconds={seconds}
              peeking={peeking}
              onPeek={() => setPeeking((p) => !p)}
              onStart={start}
              onStop={stop}
              onRate={rate}
              onSkip={advance}
              atEnd={atEnd}
            />
          ) : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/* --------------------------------- header --------------------------------- */

function Header({
  scopeLabel,
  index,
  total,
  phase,
  onClose,
}: {
  scopeLabel: string
  index: number
  total: number
  phase: Phase
  onClose: () => void
}) {
  const done = phase === 'done'
  const progress = total === 0 ? 0 : ((done ? total : index) / total) * 100
  return (
    <header className="shrink-0 border-b border-line">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Ear className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-md font-semibold tracking-[-0.012em] text-fg">Rehearsal</p>
            <p className="truncate text-xs text-muted">{scopeLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {total > 0 && (
            <p className="text-xs tabular-nums text-faint">
              {done ? total : Math.min(index + 1, total)} of {total}
            </p>
          )}
          <IconButton label="Leave the rehearsal" onClick={onClose}>
            <X />
          </IconButton>
        </div>
      </div>
      <div className="h-0.5 w-full bg-subtle" role="presentation">
        <div
          className="h-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  )
}

/* ---------------------------------- room ---------------------------------- */

function Room({
  item,
  phase,
  seconds,
  peeking,
  onPeek,
  onStart,
  onStop,
  onRate,
  onSkip,
  atEnd,
}: {
  item: DrillItem
  phase: Phase
  seconds: number
  peeking: boolean
  onPeek: () => void
  onStart: () => void
  onStop: () => void
  onRate: (rating: RehearsalRating) => void
  onSkip: () => void
  atEnd: boolean
}) {
  const ui = useAppUi()
  const { question, story, alternates } = item

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <Badge tone="accent" className="self-start">
          {question.theme}
        </Badge>

        <h2 className="mt-3 text-balance text-2xl font-semibold leading-[1.2] tracking-[-0.02em] text-fg sm:text-3xl">
          {question.text}
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          <span className="font-medium text-fg">Listening for: </span>
          {question.listeningFor}
        </p>

        {/* -- the clock -- */}
        <div className="mt-7">
          <Clock seconds={seconds} running={phase === 'speaking'} />
        </div>

        {phase === 'verdict' && (
          <div className="mt-6 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3">
            <p className="text-2xs uppercase tracking-[0.06em] text-accent">Check yourself</p>
            <p className="mt-1 text-base leading-relaxed text-fg">
              Did you get to this? <span className="text-muted">{question.listeningFor}</span>
            </p>
            {story?.metrics && (
              <p className="mt-1.5 text-sm text-muted">
                And the numbers: <span className="font-medium text-positive">{story.metrics}</span>
              </p>
            )}
            {story && <LengthNote story={story} seconds={seconds} />}
          </div>
        )}

        {/* -- what you have to answer with -- */}
        <div className="mt-6 min-h-0">
          {story ? (
            <StoryPanel story={story} peeking={peeking} onPeek={onPeek} alternates={alternates} />
          ) : (
            <NoStoryPanel
              theme={question.theme}
              onWrite={() => {
                ui.closeRehearsal()
                ui.openStoryEditor(undefined, { tags: [question.theme] })
              }}
            />
          )}
        </div>

        <div className="min-h-6 flex-1" />

        {/* -- controls -- */}
        <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {phase === 'verdict' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-base font-medium text-fg">
                {story ? 'How did that go?' : 'Ready to move on?'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {story ? (
                  <>
                    <Button variant="secondary" icon={<RotateCcw />} onClick={() => onRate('shaky')}>
                      Needs work
                    </Button>
                    <Button variant="primary" icon={<Check />} onClick={() => onRate('solid')}>
                      Solid
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" icon={<ArrowRight />} onClick={onSkip}>
                    {atEnd ? 'Finish' : 'Next question'}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {phase === 'ready' ? (
                  <Button variant="primary" icon={<Play />} onClick={onStart}>
                    Start answering
                  </Button>
                ) : (
                  <Button variant="primary" icon={<Pause />} onClick={onStop}>
                    Done answering
                  </Button>
                )}
                <Button variant="ghost" onClick={onSkip}>
                  Skip
                </Button>
              </div>
              <p className="hidden items-center gap-2 text-2xs text-faint sm:flex">
                <Kbd>Space</Kbd> start or stop
                <Kbd>P</Kbd> peek
                <Kbd>S</Kbd> skip
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * What this run's length means, against your own history rather than a rule.
 * Only appears once there is something to compare against.
 */
function LengthNote({ story, seconds }: { story: Story; seconds: number }) {
  const usual = typicalSeconds(story)
  if (seconds <= 0) return null
  const verdict = lengthVerdict(seconds)
  return (
    <p className="mt-1.5 text-sm text-muted">
      You spoke for <span className="font-medium text-fg">{formatSeconds(seconds)}</span>
      {usual !== null && (
        <>
          {' '}
          · usually <span className="font-medium text-fg">{formatSeconds(usual)}</span> on this one
        </>
      )}
      {verdict === 'long' && (
        <span className="text-caution"> — long enough that the point can get lost.</span>
      )}
      {verdict === 'short' && usual === null && (
        <span className="text-faint"> — on the short side for a story answer.</span>
      )}
    </p>
  )
}

/* --------------------------------- clock ---------------------------------- */

function Clock({ seconds, running }: { seconds: number; running: boolean }) {
  const scale = LONG_SECONDS + 60
  const pct = Math.min(100, (seconds / scale) * 100)
  const bandStart = (TARGET_MIN_SECONDS / scale) * 100
  const bandWidth = ((TARGET_MAX_SECONDS - TARGET_MIN_SECONDS) / scale) * 100

  const state = seconds > LONG_SECONDS ? 'long' : seconds >= TARGET_MIN_SECONDS ? 'good' : 'early'
  const note =
    seconds > LONG_SECONDS
      ? 'Running long — most answers land better trimmed.'
      : seconds >= TARGET_MIN_SECONDS
        ? 'Good length.'
        : running
          ? 'Aim for a minute and a half to two minutes.'
          : 'Answer out loud, as if they were sitting opposite you.'

  return (
    <div>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <p
          className={cn(
            'text-4xl font-semibold tabular-nums tracking-tight transition-colors',
            state === 'long' ? 'text-caution' : running ? 'text-fg' : 'text-faint',
          )}
          aria-live="off"
        >
          {formatSeconds(seconds)}
        </p>
        <p className={cn('text-sm sm:text-right', state === 'long' ? 'text-caution' : 'text-muted')}>
          {note}
        </p>
      </div>

      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
        {/* the comfortable band */}
        <div
          className="absolute inset-y-0 bg-positive/25"
          style={{ left: `${bandStart}%`, width: `${bandWidth}%` }}
          aria-hidden
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none',
            state === 'long' ? 'bg-caution' : state === 'good' ? 'bg-positive' : 'bg-accent',
          )}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {running ? `Speaking for ${formatSeconds(seconds)}` : `Stopped at ${formatSeconds(seconds)}`}
      </p>
    </div>
  )
}

/* ------------------------------- story panel ------------------------------ */

const SECTIONS: Array<{ key: keyof Pick<Story, 'situation' | 'task' | 'action' | 'result'>; label: string }> = [
  { key: 'situation', label: 'Situation' },
  { key: 'task', label: 'Task' },
  { key: 'action', label: 'Action' },
  { key: 'result', label: 'Result' },
]

function StoryPanel({
  story,
  peeking,
  onPeek,
  alternates,
}: {
  story: Story
  peeking: boolean
  onPeek: () => void
  alternates: Story[]
}) {
  return (
    <section className="rounded-xl border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-2xs uppercase tracking-[0.06em] text-faint">Your answer</p>
          <p className="truncate text-base font-medium text-fg">{story.title}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={peeking ? <EyeOff /> : <Eye />}
          onClick={onPeek}
          aria-expanded={peeking}
        >
          {peeking ? 'Hide notes' : 'Peek'}
        </Button>
      </header>

      {peeking ? (
        <div className="grid gap-3 px-3.5 py-3 sm:grid-cols-2">
          {SECTIONS.map(({ key, label }) => (
            <div key={key}>
              <p className="text-2xs uppercase tracking-[0.06em] text-faint">{label}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{story[key] || '—'}</p>
            </div>
          ))}
          {story.metrics && (
            <div className="sm:col-span-2">
              <p className="text-2xs uppercase tracking-[0.06em] text-faint">Numbers</p>
              <p className="mt-0.5 text-sm font-medium text-positive">{story.metrics}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="px-3.5 py-4">
          <p className="text-sm text-faint">
            Notes hidden — recalling it is the practice. Peek if you get stuck.
          </p>
          {alternates.length > 0 && (
            <p className="mt-1.5 text-xs text-faint">
              {alternates.length} other {alternates.length === 1 ? 'story' : 'stories'} could answer this too.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function NoStoryPanel({ theme, onWrite }: { theme: string; onWrite: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-line px-4 py-5">
      <p className="text-base font-medium text-fg">You have no finished {theme} story yet</p>
      <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
        Try answering anyway — what you reach for under the clock is usually the story worth writing
        down afterwards.
      </p>
      <Button size="sm" variant="secondary" icon={<Plus />} className="mt-3" onClick={onWrite}>
        Write a {theme} story
      </Button>
    </section>
  )
}

/* -------------------------------- summary --------------------------------- */

function Summary({
  log,
  planned,
  onClose,
  onAgain,
}: {
  log: Array<{ story: Story; rating: RehearsalRating }>
  planned: number
  onClose: () => void
  onAgain: () => void
}) {
  // A themed drill can put the same story in front of you more than once. Only
  // the last verdict is stored against it, so the summary reports that one —
  // otherwise a story appears under both headings at the same time.
  const latest = new Map<string, { story: Story; rating: RehearsalRating }>()
  for (const entry of log) latest.set(entry.story.id, entry)
  const verdicts = [...latest.values()]
  const solid = verdicts.filter((l) => l.rating === 'solid')
  const rough = verdicts.filter((l) => l.rating === 'shaky')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-positive-soft text-positive">
          <Sparkle className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-fg">
          {log.length === 0
            ? 'Session ended'
            : `${log.length} of ${planned} rehearsed`}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {log.length === 0
            ? 'Nothing was rated, so nothing changed.'
            : 'Ratings are saved against each story, and shape what comes up next time.'}
        </p>

        {rough.length > 0 && (
          <section className="mt-6">
            <h3 className="section-title">Worth another run</h3>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {rough.map(({ story }) => (
                <li key={story.id} className="bg-panel px-3 py-2 text-base text-fg">
                  {story.title}
                </li>
              ))}
            </ul>
          </section>
        )}

        {solid.length > 0 && (
          <section className="mt-5">
            <h3 className="section-title">Felt solid</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {solid.map(({ story }) => (
                <li key={story.id}>
                  <Badge tone="positive">{story.title}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
          <Button variant="secondary" icon={<RotateCcw />} onClick={onAgain}>
            Run it again
          </Button>
        </div>
      </div>
    </div>
  )
}

function EmptyRoom({ onClose }: { onClose: () => void }) {
  const ui = useAppUi()
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
      <div className="max-w-md text-center">
        <p className="text-lg font-medium text-fg">Nothing to rehearse yet</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Rehearsal works from the questions your stories can answer. Write one story and there will
          be something to practise.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="primary"
            icon={<Plus />}
            onClick={() => {
              ui.closeRehearsal()
              ui.openStoryEditor()
            }}
          >
            Write a story
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
