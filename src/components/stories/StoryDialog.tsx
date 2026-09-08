import * as React from 'react'
import { Star, Trash2, X } from 'lucide-react'
import { ConfirmDialog, Sheet } from '@/components/ui/overlay'
import { Button, IconButton, Meter } from '@/components/ui/primitives'
import { Field, TagInput, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { createStory, deleteStories, updateStory } from '@/lib/repo'
import { storyCompleteness } from '@/lib/stories'
import { STORY_TAGS, type Story } from '@/lib/types'
import { SKILL_SUGGESTIONS, TOOL_SUGGESTIONS } from '@/lib/skills-dictionary'
import { cn, formatAgo } from '@/lib/utils'

interface StoryForm {
  title: string
  situation: string
  task: string
  action: string
  result: string
  metrics: string
  skills: string[]
  tags: string[]
  favorite: boolean
}

const emptyStory = (): StoryForm => ({
  title: '',
  situation: '',
  task: '',
  action: '',
  result: '',
  metrics: '',
  skills: [],
  tags: [],
  favorite: false,
})

const SECTIONS: Array<{
  key: 'situation' | 'task' | 'action' | 'result'
  label: string
  prompt: string
}> = [
  { key: 'situation', label: 'Situation', prompt: 'Where were you, and what was actually going wrong?' },
  { key: 'task', label: 'Task', prompt: 'What were you specifically responsible for deciding or delivering?' },
  { key: 'action', label: 'Action', prompt: 'What did you do? Be concrete, and say "I" rather than "we".' },
  { key: 'result', label: 'Result', prompt: 'What changed? Numbers where you have them, honesty where you do not.' },
]

export function StoryDialog() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const existing = ui.storyEditor.story

  const [form, setForm] = React.useState<StoryForm>(emptyStory)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const titleRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (!ui.storyEditor.open) return
    setForm(
      existing
        ? {
            title: existing.title,
            situation: existing.situation ?? '',
            task: existing.task ?? '',
            action: existing.action ?? '',
            result: existing.result ?? '',
            metrics: existing.metrics ?? '',
            skills: existing.skills,
            tags: existing.tags,
            favorite: existing.favorite,
          }
        : { ...emptyStory(), tags: ui.storyEditor.prefill?.tags ?? [] },
    )
    setError(null)
    // Give the title focus so a new story starts with a cursor, not a form.
    window.setTimeout(() => titleRef.current?.focus(), 60)
  }, [ui.storyEditor.open, existing, ui.storyEditor.prefill])

  const update = <K extends keyof StoryForm>(key: K, value: StoryForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const draftStoryValue: Story = {
    id: existing?.id ?? 'draft',
    title: form.title,
    situation: form.situation,
    task: form.task,
    action: form.action,
    result: form.result,
    metrics: form.metrics,
    skills: form.skills,
    tags: form.tags,
    favorite: form.favorite,
    useCount: existing?.useCount ?? 0,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: existing?.updatedAt ?? new Date().toISOString(),
  }
  const completeness = storyCompleteness(draftStoryValue)
  const words = [form.situation, form.task, form.action, form.result]
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

  const save = async () => {
    if (!form.title.trim()) {
      setError('Give the story a title you will recognise under pressure.')
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        situation: form.situation.trim() || undefined,
        task: form.task.trim() || undefined,
        action: form.action.trim() || undefined,
        result: form.result.trim() || undefined,
        metrics: form.metrics.trim() || undefined,
        skills: form.skills,
        tags: form.tags,
        favorite: form.favorite,
      }
      if (existing) {
        await updateStory(existing.id, payload)
        toast.success('Story saved')
      } else {
        await createStory(payload)
        toast.success('Story added')
      }
      ui.closeStoryEditor()
    } catch (err) {
      toast.error('Could not save this story', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        open={ui.storyEditor.open}
        onOpenChange={(open) => !open && ui.closeStoryEditor()}
        title={existing ? 'Edit story' : 'New story'}
        width="lg"
        header={
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-pressed={form.favorite}
                aria-label={form.favorite ? 'Remove from favourites' : 'Mark as a favourite'}
                onClick={() => update('favorite', !form.favorite)}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  form.favorite ? 'text-caution' : 'text-faint hover:text-fg',
                )}
              >
                <Star className={cn('h-4 w-4', form.favorite && 'fill-current')} />
              </button>
              <p className="truncate text-sm text-muted">
                {existing
                  ? `Used ${existing.useCount} ${existing.useCount === 1 ? 'time' : 'times'}${existing.lastUsedAt ? ` · last ${formatAgo(existing.lastUsedAt)}` : ''}`
                  : 'New story'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {existing && (
                <IconButton label="Delete story" onClick={() => setConfirmDelete(true)}>
                  <Trash2 />
                </IconButton>
              )}
              <IconButton label="Close" onClick={() => ui.closeStoryEditor()}>
                <X />
              </IconButton>
            </div>
          </header>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 sm:px-6">
            <div>
              <Textarea
                ref={titleRef}
                autoGrow
                rows={1}
                value={form.title}
                onChange={(e) => update('title', e.target.value.replace(/\n/g, ''))}
                placeholder="Give this story a title…"
                aria-label="Story title"
                className="border-transparent bg-transparent px-0 text-xl font-semibold leading-snug tracking-[-0.015em] shadow-none hover:border-transparent focus:border-transparent focus:ring-0"
              />
              {error && (
                <p role="alert" className="text-xs text-critical">
                  {error}
                </p>
              )}
            </div>

            <div className="space-y-5">
              {SECTIONS.map((section) => (
                <div key={section.key} className="group">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h3 className="text-2xs font-semibold uppercase tracking-[0.07em] text-muted">
                      {section.label}
                    </h3>
                    <p className="truncate text-xs text-faint opacity-0 transition-opacity group-focus-within:opacity-100">
                      {section.prompt}
                    </p>
                  </div>
                  <Textarea
                    autoGrow
                    rows={3}
                    value={form[section.key]}
                    onChange={(e) => update(section.key, e.target.value)}
                    placeholder={section.prompt}
                    aria-label={section.label}
                    className="text-base leading-[1.65]"
                  />
                </div>
              ))}
            </div>

            <Field label="Numbers worth quoting" hint="The line you want to land in the room.">
              <Textarea
                autoGrow
                rows={2}
                value={form.metrics}
                onChange={(e) => update('metrics', e.target.value)}
                placeholder="Activation 38% → 49.7%; support tickets down two thirds"
                aria-label="Metrics"
              />
            </Field>

            <Field label="Themes" hint="Used to suggest this story for the right interview format.">
              <div className="flex flex-wrap gap-1.5">
                {STORY_TAGS.map((tag) => {
                  const on = form.tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        update('tags', on ? form.tags.filter((t) => t !== tag) : [...form.tags, tag])
                      }
                      className={cn(
                        'rounded-md border px-2 py-1 text-sm transition-colors',
                        on
                          ? 'border-accent/40 bg-accent-soft text-accent'
                          : 'border-line bg-panel text-muted hover:border-line-strong hover:text-fg',
                      )}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Skills demonstrated" hint="Matched against the job description when suggesting stories.">
              <TagInput
                ariaLabel="Skills demonstrated"
                value={form.skills}
                onChange={(v) => update('skills', v)}
                suggestions={[...SKILL_SUGGESTIONS, ...TOOL_SUGGESTIONS, ...workspace.allTags]}
                placeholder="SQL, Stakeholder Management…"
              />
            </Field>
          </div>
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs text-muted">
                {completeness.filled}/{completeness.total} sections
                {completeness.missing.length > 0 && (
                  <span className="text-faint"> · missing {completeness.missing.join(', ')}</span>
                )}
              </p>
              <p className="shrink-0 text-xs tabular-nums text-faint">{words} words</p>
            </div>
            <Meter
              className="mt-1.5"
              value={completeness.filled}
              max={completeness.total}
              tone={completeness.filled === completeness.total ? 'positive' : 'accent'}
              label="Story completeness"
            />
          </div>
          <Button variant="ghost" onClick={() => ui.closeStoryEditor()}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {existing ? 'Save' : 'Add story'}
          </Button>
        </footer>
      </Sheet>

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete “${existing.title}”?`}
          destructive
          confirmLabel="Delete story"
          body={<p>It is removed from any interviews where you pinned it. You can undo this once.</p>}
          onConfirm={async () => {
            const undo = await deleteStories([existing.id])
            ui.closeStoryEditor()
            toast.undoable('Story deleted', undo.undo, existing.title)
          }}
        />
      )}
    </>
  )
}
