import * as React from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog, Modal } from '@/components/ui/overlay'
import { Button } from '@/components/ui/primitives'
import { Checkbox, Field, Input, Select, TagInput, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { createContact, deleteContacts, logContactTouch, updateContact } from '@/lib/repo'
import { RELATIONSHIPS, RELATIONSHIP_META, type Contact, type Relationship } from '@/lib/types'
import { dateOnlyPlusDays, isValidEmail, normalizeUrl, today } from '@/lib/utils'

interface ContactForm {
  name: string
  relationship: Relationship
  company: string
  title: string
  email: string
  phone: string
  linkedinUrl: string
  opportunityIds: string[]
  lastContactDate: string
  nextFollowUpDate: string
  notes: string
  tags: string[]
}

const emptyContact = (): ContactForm => ({
  name: '',
  relationship: 'other',
  company: '',
  title: '',
  email: '',
  phone: '',
  linkedinUrl: '',
  opportunityIds: [],
  lastContactDate: '',
  nextFollowUpDate: '',
  notes: '',
  tags: [],
})

export function ContactDialog() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const { contactEditor } = ui
  const existing = contactEditor.contact

  const [form, setForm] = React.useState<ContactForm>(emptyContact)
  const [errors, setErrors] = React.useState<Partial<Record<keyof ContactForm, string>>>({})
  const [saving, setSaving] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const nameRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!contactEditor.open) return
    const source = existing ?? contactEditor.prefill
    setForm({
      ...emptyContact(),
      ...(source
        ? {
            name: source.name ?? '',
            relationship: source.relationship ?? 'other',
            company: source.company ?? '',
            title: source.title ?? '',
            email: source.email ?? '',
            phone: source.phone ?? '',
            linkedinUrl: source.linkedinUrl ?? '',
            opportunityIds: source.opportunityIds ?? [],
            lastContactDate: source.lastContactDate ?? '',
            nextFollowUpDate: source.nextFollowUpDate ?? '',
            notes: source.notes ?? '',
            tags: source.tags ?? [],
          }
        : {}),
    })
    setErrors({})
  }, [contactEditor.open, existing, contactEditor.prefill])

  const update = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const save = async () => {
    const next: Partial<Record<keyof ContactForm, string>> = {}
    if (!form.name.trim()) next.name = 'A name is required.'
    if (form.email.trim() && !isValidEmail(form.email)) next.email = 'That does not look like an email address.'
    if (form.linkedinUrl.trim() && !normalizeUrl(form.linkedinUrl)) next.linkedinUrl = 'That does not look like a web address.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        relationship: form.relationship,
        company: form.company.trim() || undefined,
        title: form.title.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        linkedinUrl: normalizeUrl(form.linkedinUrl),
        opportunityIds: form.opportunityIds,
        lastContactDate: form.lastContactDate || undefined,
        nextFollowUpDate: form.nextFollowUpDate || undefined,
        notes: form.notes.trim() || undefined,
        tags: form.tags,
      }
      if (existing) {
        await updateContact(existing.id, payload)
        toast.success('Contact updated')
      } else {
        await createContact(payload)
        toast.success(`Added ${payload.name}`)
      }
      ui.closeContactEditor()
    } catch (error) {
      toast.error('Could not save this contact', error instanceof Error ? error.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const linkable = workspace.opportunities.filter((o) => !o.archivedAt)

  return (
    <>
      <Modal
        open={contactEditor.open}
        onOpenChange={(open) => !open && ui.closeContactEditor()}
        title={existing ? 'Edit contact' : 'Add contact'}
        size="lg"
        initialFocusRef={nameRef}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            {existing ? (
              <Button variant="ghost" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => ui.closeContactEditor()}>
                Cancel
              </Button>
              <Button variant="primary" loading={saving} onClick={() => void save()}>
                {existing ? 'Save changes' : 'Add contact'}
              </Button>
            </div>
          </div>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required htmlFor="contact-name" error={errors.name}>
              <Input
                id="contact-name"
                ref={nameRef}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Priya Raghavan"
                autoComplete="off"
                invalid={Boolean(errors.name)}
              />
            </Field>
            <Field label="Relationship">
              <Select<Relationship>
                ariaLabel="Relationship"
                value={form.relationship}
                onChange={(v) => update('relationship', v)}
                options={RELATIONSHIPS.map((r) => ({ value: r, label: RELATIONSHIP_META[r].label }))}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company" htmlFor="contact-company">
              <Input
                id="contact-company"
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
                placeholder="Halcyon Pay"
                autoComplete="off"
              />
            </Field>
            <Field label="Title" htmlFor="contact-title">
              <Input
                id="contact-title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Director of Product"
                autoComplete="off"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" htmlFor="contact-email" error={errors.email}>
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="name@company.com"
                autoComplete="off"
                invalid={Boolean(errors.email)}
              />
            </Field>
            <Field label="Phone" htmlFor="contact-phone">
              <Input
                id="contact-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>

          <Field label="LinkedIn" htmlFor="contact-linkedin" error={errors.linkedinUrl}>
            <Input
              id="contact-linkedin"
              value={form.linkedinUrl}
              onChange={(e) => update('linkedinUrl', e.target.value)}
              placeholder="linkedin.com/in/…"
              autoComplete="off"
              invalid={Boolean(errors.linkedinUrl)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Last contact" htmlFor="contact-last">
              <Input
                id="contact-last"
                type="date"
                value={form.lastContactDate}
                onChange={(e) => update('lastContactDate', e.target.value)}
              />
            </Field>
            <Field label="Next follow-up" htmlFor="contact-next">
              <Input
                id="contact-next"
                type="date"
                value={form.nextFollowUpDate}
                onChange={(e) => update('nextFollowUpDate', e.target.value)}
              />
            </Field>
          </div>

          {linkable.length > 0 && (
            <Field label="Linked opportunities" hint="Follow-ups for linked opportunities show up on Today.">
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-line bg-panel p-2">
                {linkable.map((o) => (
                  <Checkbox
                    key={o.id}
                    checked={form.opportunityIds.includes(o.id)}
                    onChange={(checked) =>
                      update(
                        'opportunityIds',
                        checked
                          ? [...form.opportunityIds, o.id]
                          : form.opportunityIds.filter((id) => id !== o.id),
                      )
                    }
                    label={
                      <span className="text-sm">
                        <span className="font-medium">{o.company}</span>
                        <span className="text-muted"> · {o.role}</span>
                      </span>
                    }
                  />
                ))}
              </div>
            </Field>
          )}

          <Field label="Tags">
            <TagInput
              ariaLabel="Contact tags"
              value={form.tags}
              onChange={(v) => update('tags', v)}
              suggestions={workspace.allTags}
            />
          </Field>

          <Field label="Notes" htmlFor="contact-notes">
            <Textarea
              id="contact-notes"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="How you met, what they care about, what they offered to do…"
              rows={4}
            />
          </Field>
        </form>
      </Modal>

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${existing.name}?`}
          destructive
          confirmLabel="Delete contact"
          body={<p>Their notes and outreach history are removed. Linked opportunities and interviews are kept.</p>}
          onConfirm={async () => {
            const undo = await deleteContacts([existing.id])
            ui.closeContactEditor()
            toast.undoable('Contact deleted', undo.undo, existing.name)
          }}
        />
      )}
    </>
  )
}

/* ------------------------------- Log outreach ----------------------------- */

const FOLLOW_UP_PRESETS = [
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
  { label: 'In 1 month', days: 30 },
]

export function LogTouchDialog() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const contact = ui.logTouch.contactId ? workspace.contactsById.get(ui.logTouch.contactId) : undefined

  const [date, setDate] = React.useState(today())
  const [note, setNote] = React.useState('')
  const [followUp, setFollowUp] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!ui.logTouch.open) return
    setDate(today())
    setNote('')
    setFollowUp(dateOnlyPlusDays(7))
  }, [ui.logTouch.open])

  if (!contact) {
    return (
      <Modal
        open={ui.logTouch.open}
        onOpenChange={(open) => !open && ui.closeLogTouch()}
        title="Contact not found"
        size="sm"
      >
        <p className="text-base text-muted">This contact is no longer in the workspace.</p>
      </Modal>
    )
  }

  return (
    <Modal
      open={ui.logTouch.open}
      onOpenChange={(open) => !open && ui.closeLogTouch()}
      title={`Log outreach to ${contact.name}`}
      description="Opportunity OS never sends messages. This records that you reached out and schedules the next nudge."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => ui.closeLogTouch()}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={async () => {
              setSaving(true)
              try {
                const undo = await logContactTouch(contact.id, {
                  date,
                  note: note.trim() || undefined,
                  nextFollowUpDate: followUp || undefined,
                })
                ui.closeLogTouch()
                if (undo) toast.undoable(`Logged outreach to ${contact.name}`, undo.undo)
              } finally {
                setSaving(false)
              }
            }}
          >
            Log outreach
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="When" htmlFor="touch-date">
          <Input id="touch-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today()} />
        </Field>

        <Field label="What happened" htmlFor="touch-note">
          <Textarea
            id="touch-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Sent the case study and asked about the panel format."
            rows={3}
          />
        </Field>

        <Field label="Next follow-up" htmlFor="touch-followup" hint="Leave empty if no follow-up is needed.">
          <div className="space-y-2">
            <Input
              id="touch-followup"
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {FOLLOW_UP_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => setFollowUp(dateOnlyPlusDays(preset.days))}
                  className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFollowUp('')}
                className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
              >
                None
              </button>
            </div>
          </div>
        </Field>
      </div>
    </Modal>
  )
}

export type { Contact }
