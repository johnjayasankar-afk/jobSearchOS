import * as React from 'react'
import { BookMarked, Check, FileText, Plus, Trash2, X } from 'lucide-react'
import { ConfirmDialog, Sheet } from '@/components/ui/overlay'
import { Badge, Button, IconButton, Meter } from '@/components/ui/primitives'
import { Checkbox, Field, Input, ListEditor, Select, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { createInterview, deleteInterviews, markStoryUsed, updateInterview, DEFAULT_CHECKLIST } from '@/lib/repo'
import { suggestStories } from '@/lib/stories'
import {
  INTERVIEW_FORMATS,
  INTERVIEW_OUTCOMES,
  INTERVIEW_OUTCOME_META,
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_META,
  type ChecklistItem,
  type InterviewFormat,
  type InterviewOutcome,
  type InterviewType,
} from '@/lib/types'
import { cn, formatDateTime, newId } from '@/lib/utils'

/** `YYYY-MM-DDTHH:mm` in local time, which is what datetime-local expects. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function defaultScheduledAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d.toISOString()
}

interface InterviewForm {
  opportunityId: string
  scheduledAt: string
  durationMinutes: number
  type: InterviewType
  format: InterviewFormat
  contactIds: string[]
  interviewers: string
  prepNotes: string
  questionsExpected: string[]
  questionsToAsk: string[]
  checklist: ChecklistItem[]
  storyIds: string[]
  outcome: InterviewOutcome
  debrief: string
  followUpSent: boolean
}

export function InterviewDialog() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const { interviewEditor } = ui
  const existing = interviewEditor.interview

  const [form, setForm] = React.useState<InterviewForm | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  React.useEffect(() => {
    if (!interviewEditor.open) return
    const source = existing
    setForm({
      opportunityId:
        source?.opportunityId ??
        interviewEditor.opportunityId ??
        workspace.opportunities.find((o) => !o.archivedAt)?.id ??
        '',
      scheduledAt: source?.scheduledAt ?? defaultScheduledAt(),
      durationMinutes: source?.durationMinutes ?? 45,
      type: source?.type ?? 'recruiter',
      format: source?.format ?? 'video',
      contactIds: source?.contactIds ?? [],
      interviewers: source?.interviewers ?? '',
      prepNotes: source?.prepNotes ?? '',
      questionsExpected: source?.questionsExpected ?? [],
      questionsToAsk: source?.questionsToAsk ?? [],
      checklist:
        source?.checklist ?? DEFAULT_CHECKLIST.map((text) => ({ id: newId('ck_'), text, done: false })),
      storyIds: source?.storyIds ?? [],
      outcome: source?.outcome ?? 'pending',
      debrief: source?.debrief ?? '',
      followUpSent: source?.followUpSent ?? false,
    })
    setError(null)
  }, [interviewEditor.open, existing, interviewEditor.opportunityId, workspace.opportunities])

  if (!form) {
    return (
      <Sheet
        open={interviewEditor.open}
        onOpenChange={(open) => !open && ui.closeInterviewEditor()}
        title="Interview"
        width="lg"
      >
        <div className="p-6" />
      </Sheet>
    )
  }

  const update = <K extends keyof InterviewForm>(key: K, value: InterviewForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const opportunity = workspace.byId.get(form.opportunityId)
  const linkedContacts = opportunity
    ? (workspace.contactsByOpportunity.get(opportunity.id) ?? [])
    : workspace.contacts
  const suggestions = suggestStories(form, opportunity, workspace.stories)
  const pinned = form.storyIds
    .map((id) => workspace.storiesById.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
  const checklistDone = form.checklist.filter((c) => c.done).length

  const save = async () => {
    if (!form.opportunityId) {
      setError('Choose which opportunity this interview belongs to.')
      return
    }
    const scheduledAt = fromLocalInput(toLocalInput(form.scheduledAt))
    if (!scheduledAt) {
      setError('Give the interview a valid date and time.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        opportunityId: form.opportunityId,
        scheduledAt,
        durationMinutes: form.durationMinutes,
        type: form.type,
        format: form.format,
        contactIds: form.contactIds,
        interviewers: form.interviewers.trim() || undefined,
        prepNotes: form.prepNotes.trim() || undefined,
        questionsExpected: form.questionsExpected,
        questionsToAsk: form.questionsToAsk,
        checklist: form.checklist,
        storyIds: form.storyIds,
        outcome: form.outcome,
        debrief: form.debrief.trim() || undefined,
        followUpSent: form.followUpSent,
      }
      if (existing) {
        await updateInterview(existing.id, payload)
        toast.success('Interview updated')
      } else {
        await createInterview(payload)
        toast.success('Interview scheduled')
      }
      ui.closeInterviewEditor()
    } catch (err) {
      toast.error('Could not save this interview', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        open={interviewEditor.open}
        onOpenChange={(open) => !open && ui.closeInterviewEditor()}
        title={existing ? 'Interview prep' : 'Schedule interview'}
        width="xl"
        header={
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-[-0.012em] text-fg">
                {existing ? `${INTERVIEW_TYPE_META[form.type].label} interview` : 'Schedule interview'}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted">
                {opportunity ? `${opportunity.company} · ${opportunity.role}` : 'No opportunity selected'}
                {existing && ` · ${formatDateTime(form.scheduledAt)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {existing && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<FileText />}
                  onClick={() => ui.openPrepSheet(existing.id)}
                >
                  <span className="hidden sm:inline">Prep sheet</span>
                </Button>
              )}
              {existing && (
                <IconButton label="Delete interview" onClick={() => setConfirmDelete(true)}>
                  <Trash2 />
                </IconButton>
              )}
              <IconButton label="Close" onClick={() => ui.closeInterviewEditor()}>
                <X />
              </IconButton>
            </div>
          </header>
        }
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          {error && (
            <p role="alert" className="rounded-md border border-critical/40 bg-critical-soft px-3 py-2 text-sm text-critical">
              {error}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Opportunity" required>
              <Select
                ariaLabel="Opportunity"
                value={form.opportunityId}
                onChange={(v) => update('opportunityId', v)}
                placeholder="Choose an opportunity"
                options={workspace.opportunities
                  .filter((o) => !o.archivedAt)
                  .map((o) => ({ value: o.id, label: `${o.company} — ${o.role}` }))}
              />
            </Field>
            <Field label="Interview type">
              <Select<InterviewType>
                ariaLabel="Interview type"
                value={form.type}
                onChange={(v) => update('type', v)}
                options={INTERVIEW_TYPES.map((t) => ({ value: t, label: INTERVIEW_TYPE_META[t].label }))}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date and time" htmlFor="iv-when">
              <Input
                id="iv-when"
                type="datetime-local"
                value={toLocalInput(form.scheduledAt)}
                onChange={(e) => {
                  const iso = fromLocalInput(e.target.value)
                  if (iso) update('scheduledAt', iso)
                }}
              />
            </Field>
            <Field label="Duration" htmlFor="iv-duration">
              <Select
                ariaLabel="Duration"
                value={String(form.durationMinutes)}
                onChange={(v) => update('durationMinutes', Number(v))}
                options={[15, 30, 45, 60, 90, 120, 180, 240].map((m) => ({
                  value: String(m),
                  label: m >= 60 ? `${m / 60} ${m === 60 ? 'hour' : 'hours'}` : `${m} minutes`,
                }))}
              />
            </Field>
            <Field label="Format">
              <Select<InterviewFormat>
                ariaLabel="Format"
                value={form.format}
                onChange={(v) => update('format', v)}
                options={INTERVIEW_FORMATS.map((f) => ({
                  value: f,
                  label: f === 'async' ? 'Async / take-home' : f[0]!.toUpperCase() + f.slice(1),
                }))}
              />
            </Field>
          </div>

          <Field label="Interviewers" hint="Pick from the people linked to this opportunity, or type names.">
            <div className="space-y-2">
              {linkedContacts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {linkedContacts.map((c) => {
                    const on = form.contactIds.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          update(
                            'contactIds',
                            on ? form.contactIds.filter((id) => id !== c.id) : [...form.contactIds, c.id],
                          )
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm transition-colors',
                          on
                            ? 'border-accent/40 bg-accent-soft text-accent'
                            : 'border-line bg-panel text-muted hover:text-fg',
                        )}
                      >
                        {on && <Check className="h-3 w-3" aria-hidden />}
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
              <Input
                value={form.interviewers}
                onChange={(e) => update('interviewers', e.target.value)}
                placeholder="Other interviewers, e.g. “panel of four, names not confirmed”"
                aria-label="Other interviewers"
              />
            </div>
          </Field>

          <section>
            <div className="flex items-center justify-between gap-2">
              <h3 className="section-title">
                Prep checklist{' '}
                <span className="tabular-nums">
                  {checklistDone}/{form.checklist.length}
                </span>
              </h3>
              <Button
                size="xs"
                variant="ghost"
                icon={<Plus />}
                onClick={() =>
                  update('checklist', [...form.checklist, { id: newId('ck_'), text: 'New step', done: false }])
                }
              >
                Add step
              </Button>
            </div>
            {form.checklist.length > 0 && (
              <Meter
                className="mt-2"
                value={checklistDone}
                max={form.checklist.length}
                tone={checklistDone === form.checklist.length ? 'positive' : 'accent'}
                label="Prep progress"
              />
            )}
            <ul className="mt-2 space-y-1">
              {form.checklist.map((item, i) => (
                <li key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-subtle">
                  <Checkbox
                    checked={item.done}
                    ariaLabel={item.text}
                    onChange={(done) =>
                      update(
                        'checklist',
                        form.checklist.map((c) => (c.id === item.id ? { ...c, done } : c)),
                      )
                    }
                  />
                  <input
                    value={item.text}
                    aria-label={`Checklist item ${i + 1}`}
                    onChange={(e) =>
                      update(
                        'checklist',
                        form.checklist.map((c) => (c.id === item.id ? { ...c, text: e.target.value } : c)),
                      )
                    }
                    className={cn(
                      'min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-base outline-none transition-colors',
                      'hover:border-line focus:border-accent focus:bg-panel',
                      item.done && 'text-faint line-through',
                    )}
                  />
                  <IconButton
                    label={`Remove ${item.text}`}
                    size="xs"
                    className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => update('checklist', form.checklist.filter((c) => c.id !== item.id))}
                  >
                    <X />
                  </IconButton>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Questions they may ask">
              <ListEditor
                ariaLabel="Questions they may ask"
                value={form.questionsExpected}
                onChange={(v) => update('questionsExpected', v)}
                placeholder="Walk me through a product you owned…"
              />
            </Field>
            <Field label="Questions to ask them">
              <ListEditor
                ariaLabel="Questions to ask them"
                value={form.questionsToAsk}
                onChange={(v) => update('questionsToAsk', v)}
                placeholder="How does the team decide what not to build?"
              />
            </Field>
          </div>

          <section>
            <h3 className="section-title">Stories to have ready</h3>
            {pinned.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {pinned.map((story) => (
                  <li
                    key={story.id}
                    className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent-soft/50 px-2.5 py-2"
                  >
                    <BookMarked className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-base text-fg">{story.title}</span>
                    <div className="flex shrink-0 gap-1">
                      {story.tags.slice(0, 2).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                    <IconButton
                      label={`Unpin ${story.title}`}
                      size="xs"
                      onClick={() => update('storyIds', form.storyIds.filter((id) => id !== story.id))}
                    >
                      <X />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}

            {workspace.stories.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-faint">
                Your story bank is empty. Add a few STAR stories and they will be suggested here.
              </p>
            ) : suggestions.length === 0 ? (
              <p className="mt-2 text-sm text-faint">
                No story matches this interview type or posting yet. Open the Story Bank to pick one manually.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs text-faint">
                  Matched on tags and keywords from this interview type and the job description.
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {suggestions.map(({ story, reasons }) => (
                    <li
                      key={story.id}
                      className="flex items-start gap-2 rounded-md border border-line bg-panel px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base text-fg">{story.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{reasons.join(' · ')}</p>
                      </div>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => {
                          update('storyIds', [...form.storyIds, story.id])
                          void markStoryUsed(story.id)
                        }}
                      >
                        Pin
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <Field label="Prep notes" htmlFor="iv-prep">
            <Textarea
              id="iv-prep"
              value={form.prepNotes}
              onChange={(e) => update('prepNotes', e.target.value)}
              placeholder="Format, who you are meeting, what they said matters, anything you want in front of you."
              rows={5}
            />
          </Field>

          <section className="rounded-lg border border-line bg-subtle/50 p-3">
            <h3 className="section-title">After the interview</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Outcome">
                <Select<InterviewOutcome>
                  ariaLabel="Outcome"
                  value={form.outcome}
                  onChange={(v) => update('outcome', v)}
                  options={INTERVIEW_OUTCOMES.map((o) => ({ value: o, label: INTERVIEW_OUTCOME_META[o].label }))}
                />
              </Field>
              <Field label="Follow-up">
                <label className="flex h-8 items-center gap-2 text-base text-fg">
                  <Checkbox
                    checked={form.followUpSent}
                    onChange={(v) => update('followUpSent', v)}
                    ariaLabel="Follow-up sent"
                  />
                  Follow-up sent
                </label>
              </Field>
            </div>
            <div className="mt-2">
              <Field label="Debrief" htmlFor="iv-debrief">
                <Textarea
                  id="iv-debrief"
                  value={form.debrief}
                  onChange={(e) => update('debrief', e.target.value)}
                  placeholder="What went well, what you would change, what they seemed to care about."
                  rows={3}
                />
              </Field>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">
          <Button variant="ghost" onClick={() => ui.closeInterviewEditor()}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {existing ? 'Save changes' : 'Schedule interview'}
          </Button>
        </footer>
      </Sheet>

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this interview?"
          destructive
          confirmLabel="Delete interview"
          body={<p>The prep notes, questions and debrief are removed with it.</p>}
          onConfirm={async () => {
            const undo = await deleteInterviews([existing.id])
            ui.closeInterviewEditor()
            toast.undoable('Interview deleted', undo.undo)
          }}
        />
      )}
    </>
  )
}
