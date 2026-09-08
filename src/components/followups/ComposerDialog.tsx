import * as React from 'react'
import { Check, Copy, Mail, Plus, Save, Trash2, TriangleAlert } from 'lucide-react'
import { Modal, ConfirmDialog, Tooltip } from '@/components/ui/overlay'
import { Button, IconButton } from '@/components/ui/primitives'
import { Field, Input, Select, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { deleteTemplate, logContactTouch, saveTemplate, updateInterview } from '@/lib/repo'
import {
  renderTemplate,
  suggestCategory,
  TEMPLATE_VARIABLES,
  type TemplateContext,
} from '@/lib/templates'
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_META,

  type TemplateCategory,
} from '@/lib/types'
import { cn, copyText, dateOnlyPlusDays } from '@/lib/utils'

/**
 * Drafts a follow-up from a template and the record you are looking at.
 *
 * Nothing is sent. The output is text you read, edit and copy — and, once you
 * have sent it yourself, the dialog offers to log the outreach so the follow-up
 * clock on Today resets.
 */
export function ComposerDialog() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const target = ui.composer.target

  const context = React.useMemo<TemplateContext>(() => {
    if (!target) return { profile: workspace.profile }
    if (target.kind === 'interview') {
      const interview = workspace.interviewsById.get(target.interviewId)
      const opportunity = interview ? workspace.byId.get(interview.opportunityId) : undefined
      const contact = interview?.contactIds
        .map((id) => workspace.contactsById.get(id))
        .find((c): c is NonNullable<typeof c> => Boolean(c))
      return { interview, opportunity, contact, profile: workspace.profile }
    }
    if (target.kind === 'contact') {
      const contact = workspace.contactsById.get(target.contactId)
      const opportunityId = target.opportunityId ?? contact?.opportunityIds[0]
      return {
        contact,
        opportunity: opportunityId ? workspace.byId.get(opportunityId) : undefined,
        profile: workspace.profile,
      }
    }
    const opportunity = workspace.byId.get(target.opportunityId)
    const contact = (workspace.contactsByOpportunity.get(target.opportunityId) ?? [])[0]
    return { opportunity, contact, profile: workspace.profile }
  }, [target, workspace])

  const [category, setCategory] = React.useState<TemplateCategory>('networking')
  const [templateId, setTemplateId] = React.useState<string | null>(null)
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [dirty, setDirty] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [saveAsOpen, setSaveAsOpen] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  const inCategory = React.useMemo(
    () =>
      [...workspace.templates]
        .filter((t) => t.category === category)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [workspace.templates, category],
  )
  const template = workspace.templates.find((t) => t.id === templateId) ?? null

  // Pick the situation-appropriate category and its first template on open.
  React.useEffect(() => {
    if (!ui.composer.open) return
    // Settings can open the composer straight onto one template.
    const requested = ui.composer.templateId
      ? workspace.templates.find((t) => t.id === ui.composer.templateId)
      : undefined
    if (requested) {
      setCategory(requested.category)
      setTemplateId(requested.id)
      setDirty(false)
      setCopied(false)
      return
    }
    const suggested = suggestCategory(context)
    const hasSuggested = workspace.templates.some((t) => t.category === suggested)
    const nextCategory = hasSuggested ? suggested : (workspace.templates[0]?.category ?? 'other')
    setCategory(nextCategory)
    const first = workspace.templates.find((t) => t.category === nextCategory)
    setTemplateId(first?.id ?? null)
    setDirty(false)
    setCopied(false)
    // Rendering is handled by the effect below once the template is chosen.
  }, [ui.composer.open]) // eslint-disable-line react-hooks/exhaustive-deps

  const rendered = React.useMemo(
    () => (template ? renderTemplate(template, context) : null),
    [template, context],
  )

  // Re-render the draft whenever the chosen template changes, unless the user
  // has started editing — their words win.
  React.useEffect(() => {
    if (!rendered || dirty) return
    setSubject(rendered.subject)
    setBody(rendered.body)
  }, [rendered, dirty])

  const stillMissing = React.useMemo(() => {
    const text = `${subject}\n${body}`
    return TEMPLATE_VARIABLES.filter((v) => text.includes(`{{${v.token}}}`))
  }, [subject, body])

  const contactEmail = context.contact?.email
  const canLogOutreach = Boolean(context.contact)

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      toast.success(`${label} copied`)
    } else {
      toast.error('Could not reach the clipboard', 'Select the text and copy it manually.')
    }
  }

  const selectTemplate = (id: string) => {
    setTemplateId(id)
    setDirty(false)
  }

  return (
    <>
      <Modal
        open={ui.composer.open}
        onOpenChange={(open) => !open && ui.closeComposer()}
        title="Draft a follow-up"
        description={describeTarget(context)}
        size="xl"
        bodyClassName="p-0"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-faint">
              Opportunity OS never sends messages. Copy the draft into your own email client.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {canLogOutreach && (
                <Button
                  variant="secondary"
                  icon={<Check />}
                  onClick={async () => {
                    const contact = context.contact
                    if (!contact) return
                    const undo = await logContactTouch(contact.id, {
                      note: subject || undefined,
                      nextFollowUpDate: dateOnlyPlusDays(7),
                    })
                    if (context.interview && !context.interview.followUpSent) {
                      await updateInterview(context.interview.id, { followUpSent: true })
                    }
                    ui.closeComposer()
                    if (undo) toast.undoable(`Logged outreach to ${contact.name}`, undo.undo)
                  }}
                >
                  I sent it — log the outreach
                </Button>
              )}
              {contactEmail && (
                <Tooltip content="Opens your own email client with the draft filled in. Nothing is sent.">
                  <a
                    href={`mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-panel px-3 text-base font-medium text-fg shadow-xs transition-colors hover:bg-subtle"
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    Open in email
                  </a>
                </Tooltip>
              )}
              <Button
                variant="primary"
                icon={copied ? <Check /> : <Copy />}
                onClick={() => void copy(subject ? `${subject}\n\n${body}` : body, 'Draft')}
              >
                {copied ? 'Copied' : 'Copy draft'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid min-h-0 sm:grid-cols-[13rem_1fr]">
          <aside className="border-b border-line bg-subtle/40 p-2 sm:border-b-0 sm:border-r">
            <Field label="Situation" className="px-1 pb-2">
              <Select<TemplateCategory>
                ariaLabel="Template category"
                size="sm"
                value={category}
                onChange={(next) => {
                  setCategory(next)
                  const first = workspace.templates.find((t) => t.category === next)
                  setTemplateId(first?.id ?? null)
                  setDirty(false)
                }}
                options={TEMPLATE_CATEGORIES.map((c) => ({
                  value: c,
                  label: TEMPLATE_CATEGORY_META[c].label,
                }))}
              />
            </Field>
            <p className="px-1 pb-2 text-xs leading-relaxed text-faint">
              {TEMPLATE_CATEGORY_META[category].hint}
            </p>
            <ul className="max-h-56 space-y-0.5 overflow-y-auto sm:max-h-[22rem]">
              {inCategory.length === 0 ? (
                <li className="px-2 py-3 text-center text-sm text-faint">
                  No templates here yet. Write one and save it.
                </li>
              ) : (
                inCategory.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectTemplate(t.id)}
                      aria-current={t.id === templateId ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        t.id === templateId
                          ? 'bg-panel font-medium text-fg shadow-xs ring-1 ring-line'
                          : 'text-muted hover:bg-subtle hover:text-fg',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-2 border-t border-line pt-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus />}
                className="w-full justify-start"
                onClick={() => {
                  setTemplateId(null)
                  setSubject('')
                  setBody('')
                  setDirty(true)
                }}
              >
                Start from blank
              </Button>
            </div>
          </aside>

          <div className="min-w-0 space-y-3 p-4">
            {stillMissing.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-caution/40 bg-caution-soft/60 px-3 py-2">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caution" aria-hidden />
                <p className="text-xs leading-relaxed text-muted">
                  <span className="font-medium text-fg">
                    {stillMissing.length} placeholder{stillMissing.length === 1 ? '' : 's'} left to fill:
                  </span>{' '}
                  {stillMissing.map((v) => v.label.toLowerCase()).join(', ')}. Add{' '}
                  {stillMissing.map((v) => v.requires).filter((r, i, a) => a.indexOf(r) === i).join(', ')}, or
                  edit the draft directly.
                </p>
              </div>
            )}

            <Field
              label="Subject"
              htmlFor="composer-subject"
              action={
                subject ? (
                  <button
                    type="button"
                    onClick={() => void copy(subject, 'Subject')}
                    className="text-xs text-muted transition-colors hover:text-fg"
                  >
                    Copy
                  </button>
                ) : undefined
              }
            >
              <Input
                id="composer-subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value)
                  setDirty(true)
                }}
                placeholder="Subject line"
              />
            </Field>

            <Field
              label="Message"
              htmlFor="composer-body"
              action={
                <span className="flex items-center gap-2">
                  <span className="text-2xs tabular-nums text-faint">{body.trim().split(/\s+/).filter(Boolean).length} words</span>
                  <button
                    type="button"
                    onClick={() => void copy(body, 'Message')}
                    className="text-xs text-muted transition-colors hover:text-fg"
                  >
                    Copy
                  </button>
                </span>
              }
            >
              <Textarea
                id="composer-body"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  setDirty(true)
                }}
                rows={14}
                className="font-normal leading-relaxed"
                placeholder="Write the message, or pick a template on the left."
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              {template && dirty && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Save />}
                  onClick={async () => {
                    await saveTemplate({ id: template.id, name: template.name, category: template.category, subject, body })
                    setDirty(false)
                    toast.success(`Updated “${template.name}”`)
                  }}
                >
                  Save to this template
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus />}
                disabled={!body.trim()}
                onClick={() => {
                  setNewName(template ? `${template.name} (copy)` : '')
                  setSaveAsOpen(true)
                }}
              >
                Save as new template
              </Button>
              {template && (
                <IconButton
                  label={`Delete the “${template.name}” template`}
                  size="sm"
                  className="ml-auto"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 />
                </IconButton>
              )}
            </div>

            <details className="rounded-md border border-line bg-subtle/50 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted">
                Placeholders you can use
              </summary>
              <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <li key={v.token} className="flex items-baseline gap-2 text-xs">
                    <code className="shrink-0 rounded bg-raised px-1 font-mono text-2xs text-fg">
                      {`{{${v.token}}}`}
                    </code>
                    <span className="min-w-0 truncate text-muted">{v.label}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={saveAsOpen}
        onOpenChange={setSaveAsOpen}
        title="Save as a new template"
        confirmLabel="Save template"
        body={
          <div className="space-y-2">
            <p>It is added to the {TEMPLATE_CATEGORY_META[category].label.toLowerCase()} list.</p>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name"
              aria-label="Template name"
            />
          </div>
        }
        onConfirm={async () => {
          const saved = await saveTemplate({
            name: newName.trim() || 'Untitled template',
            category,
            subject,
            body,
          })
          setTemplateId(saved.id)
          setDirty(false)
          toast.success(`Saved “${saved.name}”`)
        }}
      />

      {template && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete the “${template.name}” template?`}
          destructive
          confirmLabel="Delete template"
          body={<p>The draft in front of you is unaffected. You can undo this once.</p>}
          onConfirm={async () => {
            const undo = await deleteTemplate(template.id)
            setTemplateId(null)
            toast.undoable('Template deleted', undo.undo, template.name)
          }}
        />
      )}
    </>
  )
}

function describeTarget(context: TemplateContext): string {
  const parts: string[] = []
  if (context.contact) parts.push(context.contact.name)
  if (context.opportunity) parts.push(`${context.opportunity.company} · ${context.opportunity.role}`)
  if (parts.length === 0) return 'No record linked — the draft will use placeholders.'
  return parts.join(' — ')
}
