import * as React from 'react'
import { Download, EyeOff, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/primitives'
import { ConfirmDialog, Modal } from '@/components/ui/overlay'
import { Field, Input, Select, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { useWorkspace } from '@/state/workspace'
import {
  deleteQuestion,
  loadStarterQuestions,
  removeStarterQuestions,
  saveQuestion,
  setQuestionHidden,
} from '@/lib/repo'
import { QUESTIONS } from '@/lib/questions'
import { STARTER_SETS, type Discipline } from '@/lib/starter-questions'
import {
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_META,
  STORY_TAGS,
  type CustomQuestion,
  type InterviewType,
  type StoryTag,
} from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Making the bank yours.
 *
 * The built-in questions were written from product-management interviews, and
 * saying so is more useful than pretending they are universal. Anyone else
 * needs two things: their own questions counted on equal terms, and a way to
 * put aside the ones that will never come up for them. Both are here, and both
 * feed straight into coverage, drills and the debrief checklist.
 */
export function QuestionsSection() {
  const workspace = useWorkspace()
  const toast = useToast()
  const [editing, setEditing] = React.useState<CustomQuestion | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<CustomQuestion | null>(null)
  const [filter, setFilter] = React.useState('')

  const hidden = new Set(workspace.settings.hiddenQuestionIds ?? [])
  const q = filter.trim().toLowerCase()
  const matches = (text: string, theme: string) =>
    !q || text.toLowerCase().includes(q) || theme.toLowerCase().includes(q)

  const mine = workspace.questions.filter((question) => matches(question.text, question.theme))
  const builtIn = QUESTIONS.filter((question) => matches(question.text, question.theme))

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-[18rem] max-w-2xl flex-1">
            <h2 className="text-md font-semibold text-fg">Interview questions</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The {QUESTIONS.length} built-in questions were written from product-management
              interviews. Add your own and they count exactly the same — in the readiness map, in
              rehearsal, and on the debrief checklist. Set aside any that will never come up in your
              field.
            </p>
          </div>
          <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
            Add a question
          </Button>
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search questions…"
            aria-label="Search questions"
            className="h-8 w-full rounded-md border border-line bg-panel pl-8 pr-3 text-base text-fg shadow-xs transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </section>

      {/* -- a starting point for another field -- */}
      <StarterSets />

      {/* -- the user's own -- */}
      <section>
        <h3 className="section-title">
          Your questions
          {workspace.questions.length > 0 && (
            <span className="ml-1.5 tabular-nums">{workspace.questions.length}</span>
          )}
        </h3>
        {workspace.questions.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm leading-relaxed text-faint">
            None yet. Anything an interviewer asked that is not below is worth adding — the debrief
            records those for you, and the readiness map offers them here in one tap.
          </p>
        ) : mine.length === 0 ? (
          <p className="mt-2 text-sm text-faint">None of yours match that search.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
            {mine.map((question) => (
              <li
                key={question.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-panel px-3.5 py-2.5"
              >
                <div className="min-w-[14rem] flex-1">
                  <p className="text-base leading-snug text-fg">{question.text}</p>
                  <p className="mt-0.5 text-2xs text-faint">
                    {question.theme}
                    {question.also?.length ? ` · also ${question.also.join(', ')}` : ''} ·{' '}
                    {question.formats.length === INTERVIEW_TYPES.length
                      ? 'any format'
                      : question.formats.map((f) => INTERVIEW_TYPE_META[f].label).join(', ')}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <IconButton label={`Edit "${question.text}"`} size="sm" onClick={() => setEditing(question)}>
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label={`Delete "${question.text}"`}
                    size="sm"
                    onClick={() => setConfirmDelete(question)}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -- the built-ins -- */}
      <section>
        <h3 className="section-title">
          Built in
          {hidden.size > 0 && (
            <span className="ml-1.5 font-normal normal-case tracking-normal text-faint">
              {hidden.size} set aside
            </span>
          )}
        </h3>
        {builtIn.length === 0 ? (
          <p className="mt-2 text-sm text-faint">No built-in question matches that search.</p>
        ) : (
          <div className="mt-2 space-y-4">
            {STORY_TAGS.map((tag) => {
              const group = builtIn.filter((question) => question.theme === tag)
              if (group.length === 0) return null
              const off = group.filter((question) => hidden.has(question.id)).length
              return (
                <div key={tag}>
                  <div className="flex items-baseline gap-2 px-0.5">
                    <h4 className="text-sm font-medium text-fg">{tag}</h4>
                    <span className="text-2xs tabular-nums text-faint">
                      {group.length}
                      {off > 0 && ` · ${off} set aside`}
                    </span>
                  </div>
                  <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-lg border border-line">
                    {group.map((question) => {
                      const isOff = hidden.has(question.id)
                      return (
                        <li
                          key={question.id}
                          className={cn(
                            'flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 transition-colors',
                            isOff ? 'bg-subtle/50' : 'bg-panel',
                          )}
                        >
                          <div className="min-w-[14rem] flex-1">
                            <p
                              className={cn(
                                'text-base leading-snug',
                                isOff ? 'text-faint line-through' : 'text-fg',
                              )}
                            >
                              {question.text}
                            </p>
                            <p className="mt-0.5 text-2xs leading-relaxed text-faint">
                              {question.listeningFor}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto"
                            icon={isOff ? <RotateCcw /> : <EyeOff />}
                            onClick={async () => {
                              const { undo } = await setQuestionHidden(question.id, !isOff)
                              toast.undoable(
                                isOff ? 'Question restored' : 'Question set aside',
                                undo,
                                question.text,
                              )
                            }}
                          >
                            <span className="hidden sm:inline">{isOff ? 'Restore' : 'Set aside'}</span>
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <QuestionEditor
        state={editing}
        onClose={() => setEditing(null)}
        onSaved={(created) => toast.success(created ? 'Question added' : 'Question saved')}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete this question?"
        confirmLabel="Delete"
        destructive
        body={
          <p>
            It disappears from coverage and drills. Debriefs that recorded it keep the record, but it
            will no longer be counted.
          </p>
        }
        onConfirm={async () => {
          if (!confirmDelete) return
          const { undo } = await deleteQuestion(confirmDelete.id)
          toast.undoable('Question deleted', undo, confirmDelete.text)
          setConfirmDelete(null)
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Editable is not the same as usable: nobody writes twenty questions from
 * scratch. These give anyone outside product a real bank in one click, added
 * as their own so every one can still be edited or thrown away.
 */
function StarterSets() {
  const workspace = useWorkspace()
  const toast = useToast()
  const [busy, setBusy] = React.useState<Discipline | null>(null)

  const loadedTexts = new Set(workspace.questions.map((q) => q.text.trim().toLowerCase()))

  return (
    <section>
      <h3 className="section-title">Starting points for other fields</h3>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
        Each set is added to your own questions, so you can edit or delete any of them. The built-ins
        stay — most of what they ask about failure, conflict and stakeholders applies anywhere — and
        anything that does not fit your field can be set aside below.
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {STARTER_SETS.map((set) => {
          const already = set.questions.filter((q) => loadedTexts.has(q.text.trim().toLowerCase())).length
          const allLoaded = already === set.questions.length
          return (
            <article key={set.id} className="flex min-w-0 flex-col rounded-lg border border-line bg-panel p-3.5">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-md font-medium text-fg">{set.label}</h4>
                <span className="shrink-0 text-2xs tabular-nums text-faint">
                  {set.questions.length} questions
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{set.description}</p>
              <div className="mt-3 flex-1" />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Download />}
                  loading={busy === set.id}
                  disabled={allLoaded}
                  onClick={async () => {
                    setBusy(set.id)
                    try {
                      const { added, undo } = await loadStarterQuestions(set.questions)
                      if (added === 0) toast.success('Already in your bank')
                      else
                        toast.undoable(
                          `Added ${added} ${set.label.toLowerCase()} ${added === 1 ? 'question' : 'questions'}`,
                          undo,
                          'They count in coverage and rehearsal straight away.',
                        )
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  {allLoaded ? 'Added' : 'Add these'}
                </Button>
                {already > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 />}
                    onClick={async () => {
                      const { removed, undo } = await removeStarterQuestions(set.questions)
                      toast.undoable(
                        `Removed ${removed} ${removed === 1 ? 'question' : 'questions'}`,
                        undo,
                        'Anything you had edited was left alone.',
                      )
                    }}
                  >
                    Remove
                  </Button>
                )}
                {already > 0 && !allLoaded && (
                  <span className="text-2xs tabular-nums text-faint">{already} of these</span>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function QuestionEditor({
  state,
  onClose,
  onSaved,
  initialText,
}: {
  state: CustomQuestion | 'new' | null
  onClose: () => void
  onSaved?: (created: boolean) => void
  /** Pre-fills a new question, e.g. one a debrief recorded. */
  initialText?: string
}) {
  const existing = state && state !== 'new' ? state : null
  const [text, setText] = React.useState('')
  const [theme, setTheme] = React.useState<StoryTag>('Leadership')
  const [also, setAlso] = React.useState<StoryTag[]>([])
  const [formats, setFormats] = React.useState<InterviewType[]>([])
  const [listeningFor, setListeningFor] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!state) return
    setText(existing?.text ?? initialText ?? '')
    setTheme(existing?.theme ?? 'Leadership')
    setAlso(existing?.also ?? [])
    setFormats(existing?.formats ?? [])
    setListeningFor(existing?.listeningFor ?? '')
    setError(null)
  }, [state, existing, initialText])

  const save = async () => {
    if (!text.trim()) {
      setError('Write the question as an interviewer would ask it.')
      return
    }
    setSaving(true)
    try {
      await saveQuestion({
        id: existing?.id,
        createdAt: existing?.createdAt,
        text,
        theme,
        also: also.filter((t) => t !== theme),
        formats,
        listeningFor,
      })
      onSaved?.(!existing)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(state)}
      onOpenChange={(open) => !open && onClose()}
      title={existing ? 'Edit question' : 'Add a question'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {existing ? 'Save' : 'Add question'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="The question" error={error} required htmlFor="cq-text">
          <Textarea
            id="cq-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="e.g. Walk me through a design critique you led."
          />
        </Field>

        <Field
          label="Theme"
          hint="Which of your stories could answer it. This is what puts the question into coverage and drills."
          htmlFor="cq-theme"
        >
          <Select<StoryTag>
            id="cq-theme"
            value={theme}
            onChange={setTheme}
            options={STORY_TAGS.map((t) => ({ value: t, label: t }))}
          />
        </Field>

        <Field label="Other themes that would serve" hint="Optional.">
          <ChipToggles
            options={STORY_TAGS.filter((t) => t !== theme)}
            value={also}
            onChange={setAlso}
            ariaLabel="Other themes"
          />
        </Field>

        <Field
          label="Formats it comes up in"
          hint="Leave all off to have it offered in every format."
        >
          <ChipToggles
            options={[...INTERVIEW_TYPES]}
            value={formats}
            onChange={setFormats}
            label={(f) => INTERVIEW_TYPE_META[f].label}
            ariaLabel="Interview formats"
          />
        </Field>

        <Field
          label="What it is really after"
          hint="Optional. Shown while you rehearse, so write what you want to remember."
          htmlFor="cq-listening"
        >
          <Input
            id="cq-listening"
            value={listeningFor}
            onChange={(e) => setListeningFor(e.target.value)}
            placeholder="e.g. Whether you can take criticism without defending the work."
          />
        </Field>
      </div>
    </Modal>
  )
}

function ChipToggles<T extends string>({
  options,
  value,
  onChange,
  label,
  ariaLabel,
}: {
  options: T[]
  value: T[]
  onChange: (next: T[]) => void
  label?: (value: T) => string
  ariaLabel: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const on = value.includes(option)
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== option) : [...value, option])}
            className={cn(
              'rounded border px-2 py-0.5 text-2xs font-medium transition-colors',
              on
                ? 'border-accent bg-accent-soft text-fg'
                : 'border-line bg-panel text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            {label ? label(option) : option}
          </button>
        )
      })}
    </div>
  )
}
