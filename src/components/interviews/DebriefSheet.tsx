import * as React from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import { Sheet } from '@/components/ui/overlay'
import { Badge, Button, IconButton } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { useBank } from '@/hooks/useBank'
import { saveDebrief } from '@/lib/repo'
import { questionsForDebrief } from '@/lib/debrief'

import {
  ANSWER_VERDICTS,
  ANSWER_VERDICT_META,
  DEBRIEF_READS,
  DEBRIEF_READ_META,
  INTERVIEW_TYPE_META,
  type AnswerVerdict,
  type AskedQuestion,
  type DebriefRead,
  type InterviewOutcome,
} from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

/**
 * The debrief.
 *
 * Everything else in the app is about what is coming. This is the only place
 * that looks back, and it has a short shelf life: an hour after the call you
 * can list the questions, and three days later the honest answer is "it went
 * fine", which teaches nobody anything.
 *
 * So it asks for one thing above all — what they actually asked — and makes
 * that as close to tapping as it can be. Everything else is optional.
 */
export function DebriefSheet() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()

  const interview = workspace.interviews.find((iv) => iv.id === ui.debrief.interviewId)
  const opportunity = workspace.opportunities.find((o) => o.id === interview?.opportunityId)

  const [picked, setPicked] = React.useState<Map<string, AnswerVerdict>>(new Map())
  const [extras, setExtras] = React.useState<Array<{ text: string; verdict: AnswerVerdict }>>([])
  const [draft, setDraft] = React.useState('')
  const [read, setRead] = React.useState<DebriefRead | null>(null)
  const [outcome, setOutcome] = React.useState<InterviewOutcome>('pending')
  const [notes, setNotes] = React.useState('')
  const [filter, setFilter] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const bank = useBank()

  // Seed from whatever is already recorded, so reopening edits rather than
  // starting again.
  React.useEffect(() => {
    if (!ui.debrief.open || !interview) return
    const next = new Map<string, AnswerVerdict>()
    const other: Array<{ text: string; verdict: AnswerVerdict }> = []
    for (const entry of interview.askedQuestions ?? []) {
      if (entry.questionId) next.set(entry.questionId, entry.verdict)
      else if (entry.text) other.push({ text: entry.text, verdict: entry.verdict })
    }
    setPicked(next)
    setExtras(other)
    setRead(interview.debriefRead ?? null)
    setOutcome(interview.outcome)
    setNotes(interview.debrief ?? '')
    setDraft('')
    setFilter('')
  }, [ui.debrief.open, interview])

  const offered = React.useMemo(() => {
    if (!interview) return []
    const base = questionsForDebrief(interview, bank)
    const q = filter.trim().toLowerCase()
    // Anything already ticked stays visible even when it falls out of the
    // filter, so a search cannot silently hide what you have recorded.
    const list = q
      ? bank.filter(
          (question) =>
            picked.has(question.id) ||
            question.text.toLowerCase().includes(q) ||
            question.theme.toLowerCase().includes(q),
        )
      : base
    return [...list].sort((a, b) => {
      const byPicked = Number(picked.has(b.id)) - Number(picked.has(a.id))
      return byPicked !== 0 ? byPicked : a.theme.localeCompare(b.theme) || a.text.localeCompare(b.text)
    })
  }, [interview, filter, picked, bank])

  if (!interview) return null

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Map(current)
      if (next.has(id)) next.delete(id)
      else next.set(id, 'ok')
      return next
    })

  const setVerdict = (id: string, verdict: AnswerVerdict) =>
    setPicked((current) => new Map(current).set(id, verdict))

  const addExtra = () => {
    const text = draft.trim()
    if (!text) return
    setExtras((e) => [...e, { text, verdict: 'ok' }])
    setDraft('')
  }

  const total = picked.size + extras.length

  const save = async () => {
    setSaving(true)
    try {
      const asked: AskedQuestion[] = [
        ...[...picked.entries()].map(([questionId, verdict]) => ({ questionId, verdict })),
        ...extras.map((e) => ({ text: e.text, verdict: e.verdict })),
      ]
      const { undo } = await saveDebrief(interview.id, {
        askedQuestions: asked,
        debriefRead: read ?? undefined,
        debrief: notes.trim() || undefined,
        outcome,
      })
      ui.closeDebrief()
      toast.undoable(
        'Debrief saved',
        undo,
        total === 0
          ? 'No questions recorded.'
          : `${total} ${total === 1 ? 'question' : 'questions'} recorded.`,
      )
    } catch (error) {
      toast.error('Could not save the debrief', error instanceof Error ? error.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = INTERVIEW_TYPE_META[interview.type].label

  return (
    <Sheet
      open={ui.debrief.open}
      onOpenChange={(open) => !open && ui.closeDebrief()}
      title="Debrief"
      width="xl"
      header={
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-[-0.012em] text-fg">
              What did they ask?
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted">
              {typeLabel} · {opportunity ? `${opportunity.company} · ` : ''}
              {formatDate(interview.scheduledAt)}
            </p>
          </div>
          <IconButton label="Close the debrief" onClick={() => ui.closeDebrief()}>
            <X />
          </IconButton>
        </header>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Tick what came up while you can still remember it. This is the only record in the app of
          what interviewers actually ask you — it is what makes the readiness map yours rather than
          a generic list.
        </p>

        {/* -- search -- */}
        <div className="relative mt-4 max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Search all ${bank.length} questions…`}
            aria-label="Search questions"
            className="h-8 w-full rounded-md border border-line bg-panel pl-8 pr-3 text-base text-fg shadow-xs transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
          {offered.map((question) => {
            const on = picked.has(question.id)
            return (
              <li key={question.id} className={cn('bg-panel transition-colors', on && 'bg-accent-soft/30')}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3.5 py-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(question.id)}
                    // The minimum width is what makes the row wrap instead of
                    // squeezing the question into a one-word column once the
                    // verdict picker appears beside it.
                    className="flex min-w-[14rem] flex-1 items-start gap-2.5 text-left"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        on ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong',
                      )}
                      aria-hidden
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base leading-snug text-fg">{question.text}</span>
                      <span className="mt-0.5 block text-2xs text-faint">{question.theme}</span>
                    </span>
                  </button>
                  {on && (
                    <div className="ml-auto">
                      <VerdictPicker
                        value={picked.get(question.id) ?? 'ok'}
                        onChange={(v) => setVerdict(question.id, v)}
                      />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
          {offered.length === 0 && (
            <li className="bg-panel px-3.5 py-6 text-center text-sm text-faint">
              Nothing matches. Add it below instead.
            </li>
          )}
        </ul>

        {/* -- anything the bank does not carry -- */}
        <section className="mt-5">
          <h3 className="section-title">Anything else they asked</h3>
          <p className="mt-1 text-sm text-muted">
            Questions outside the bank are worth keeping too — they are usually the ones specific to
            the company.
          </p>
          {extras.length > 0 && (
            <ul className="mt-2.5 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {extras.map((extra, i) => (
                <li
                  key={`${extra.text}-${i}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-panel px-3.5 py-2.5"
                >
                  <span className="min-w-[12rem] flex-1 text-base text-fg">{extra.text}</span>
                  <VerdictPicker
                    value={extra.verdict}
                    onChange={(v) =>
                      setExtras((list) => list.map((x, j) => (j === i ? { ...x, verdict: v } : x)))
                    }
                  />
                  <IconButton
                    label={`Remove "${extra.text}"`}
                    size="sm"
                    onClick={() => setExtras((list) => list.filter((_, j) => j !== i))}
                  >
                    <X />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addExtra()
                }
              }}
              placeholder="e.g. Why this company, specifically?"
              aria-label="Another question they asked"
              className="h-9 min-w-[12rem] flex-1 rounded-md border border-line bg-panel px-3 text-base text-fg shadow-xs transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            <Button variant="secondary" icon={<Plus />} onClick={addExtra} disabled={!draft.trim()}>
              Add
            </Button>
          </div>
        </section>

        {/* -- what came of it -- */}
        <section className="mt-6">
          <h3 className="section-title">Have you heard back?</h3>
          <p className="mt-1 text-sm text-muted">
            Often you have not yet, and that is fine — Today asks again later. Recording it is what
            fills in which rounds you get past.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([
              ['advanced', 'Moved on'],
              ['rejected', 'Rejected'],
              ['pending', 'Not yet'],
            ] as Array<[InterviewOutcome, string]>).map(([value, label]) => {
              const on = outcome === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setOutcome(value)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-base font-medium transition-colors',
                    on
                      ? value === 'advanced'
                        ? 'border-positive/50 bg-positive-soft text-fg'
                        : value === 'rejected'
                          ? 'border-critical/50 bg-critical-soft text-fg'
                          : 'border-accent bg-accent-soft text-fg'
                      : 'border-line bg-panel text-muted hover:border-line-strong hover:text-fg',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        {/* -- overall read -- */}
        <section className="mt-6">
          <h3 className="section-title">Your read on it</h3>
          <p className="mt-1 text-sm text-muted">How it felt, which is a different question.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEBRIEF_READS.map((value) => {
              const meta = DEBRIEF_READ_META[value]
              const on = read === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRead(on ? null : value)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-left transition-colors',
                    on
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-panel hover:border-line-strong',
                  )}
                >
                  <span className={cn('block text-base font-medium', on ? 'text-fg' : 'text-muted')}>
                    {meta.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-faint">{meta.hint}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-6">
          <label htmlFor="debrief-notes" className="section-title">
            Notes
          </label>
          <textarea
            id="debrief-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="What you would do differently, what they seemed to care about, anything you promised to send."
            className="mt-2 w-full resize-y rounded-md border border-line bg-panel px-3 py-2 text-base leading-relaxed text-fg shadow-xs transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </section>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
        <p className="text-sm text-muted">
          {total === 0 ? (
            'Nothing recorded yet.'
          ) : (
            <>
              <span className="font-medium tabular-nums text-fg">{total}</span>{' '}
              {total === 1 ? 'question' : 'questions'} recorded
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => ui.closeDebrief()}>
            Not now
          </Button>
          <Button variant="primary" icon={<Check />} loading={saving} onClick={() => void save()}>
            Save debrief
          </Button>
        </div>
      </footer>
    </Sheet>
  )
}

function VerdictPicker({
  value,
  onChange,
}: {
  value: AnswerVerdict
  onChange: (value: AnswerVerdict) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="How that answer went"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-line bg-subtle p-0.5"
    >
      {ANSWER_VERDICTS.map((verdict) => {
        const meta = ANSWER_VERDICT_META[verdict]
        const on = value === verdict
        return (
          <button
            key={verdict}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={meta.label}
            onClick={() => onChange(verdict)}
            className={cn(
              'rounded px-2 py-0.5 text-2xs font-medium transition-colors',
              on
                ? verdict === 'badly'
                  ? 'bg-critical-soft text-critical shadow-xs'
                  : verdict === 'well'
                    ? 'bg-positive-soft text-positive shadow-xs'
                    : 'bg-panel text-fg shadow-xs'
                : 'text-muted hover:text-fg',
            )}
          >
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

export function DebriefBadge({ read }: { read: DebriefRead }) {
  return <Badge tone={DEBRIEF_READ_META[read].tone}>{DEBRIEF_READ_META[read].label}</Badge>
}
