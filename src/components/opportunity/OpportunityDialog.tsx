import * as React from 'react'
import { ChevronDown, CircleAlert, Link2, Plus, TextSearch } from 'lucide-react'
import { Modal } from '@/components/ui/overlay'
import { Button, Kbd } from '@/components/ui/primitives'
import { Field, Input, Select, TagInput, Textarea } from '@/components/ui/form'
import { StagePicker, PriorityPicker, FitScore } from '@/components/common'
import { useToast } from '@/components/ui/toast'
import { useWorkspace } from '@/state/workspace'
import { useAppUi } from '@/state/app-ui'
import { createOpportunity, updateOpportunity, type NewOpportunity } from '@/lib/repo'
import { annualize, guessFromUrl, parseJobDescription, type ParsedJobDescription } from '@/lib/parse'
import { computeFit } from '@/lib/fit'
import { findDuplicates } from '@/lib/duplicates'
import {
  SOURCE_SUGGESTIONS,
  STAGE_META,
  WORK_ARRANGEMENTS,
  WORK_ARRANGEMENT_LABEL,
  type Opportunity,
  type Priority,
  type Stage,
  type WorkArrangement,
} from '@/lib/types'
import { CURRENCIES, cn, isMac, normalizeUrl, today, uniq } from '@/lib/utils'

interface FormState {
  company: string
  role: string
  jobUrl: string
  location: string
  workArrangement: WorkArrangement
  salaryMin: string
  salaryMax: string
  currency: string
  source: string
  stage: Stage
  priority: Priority
  tags: string[]
  dateDiscovered: string
  dateApplied: string
  deadline: string
  nextAction: string
  nextActionDate: string
  whyInterested: string
  jobDescription: string
}

const emptyForm = (): FormState => ({
  company: '',
  role: '',
  jobUrl: '',
  location: '',
  workArrangement: 'unknown',
  salaryMin: '',
  salaryMax: '',
  currency: 'USD',
  source: '',
  stage: 'saved',
  priority: 'medium',
  tags: [],
  dateDiscovered: today(),
  dateApplied: '',
  deadline: '',
  nextAction: '',
  nextActionDate: '',
  whyInterested: '',
  jobDescription: '',
})

function fromOpportunity(o: Opportunity): FormState {
  return {
    company: o.company,
    role: o.role,
    jobUrl: o.jobUrl ?? '',
    location: o.location ?? '',
    workArrangement: o.workArrangement,
    salaryMin: o.salaryMin ? String(o.salaryMin) : '',
    salaryMax: o.salaryMax ? String(o.salaryMax) : '',
    currency: o.currency,
    source: o.source ?? '',
    stage: o.stage,
    priority: o.priority,
    tags: o.tags,
    dateDiscovered: o.dateDiscovered,
    dateApplied: o.dateApplied ?? '',
    deadline: o.deadline ?? '',
    nextAction: o.nextAction ?? '',
    nextActionDate: o.nextActionDate ?? '',
    whyInterested: o.whyInterested ?? '',
    jobDescription: o.jobDescription ?? '',
  }
}

const toNumber = (value: string): number | undefined => {
  const n = Number(value.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}

export function OpportunityDialog({
  open,
  onOpenChange,
  existing,
  prefill,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing?: Opportunity
  prefill?: Partial<NewOpportunity>
}) {
  const toast = useToast()
  const ui = useAppUi()
  const { profile, allTags, allSources, opportunities } = useWorkspace()
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({})
  const [showDetails, setShowDetails] = React.useState(false)
  const [parsed, setParsed] = React.useState<ParsedJobDescription | null>(null)
  const [appliedFields, setAppliedFields] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const companyRef = React.useRef<HTMLInputElement>(null)

  // Reset whenever the dialog opens so a stale draft never leaks between records.
  React.useEffect(() => {
    if (!open) return
    const base = existing ? fromOpportunity(existing) : { ...emptyForm(), ...normalizePrefill(prefill) }
    setForm(base)
    setErrors({})
    setParsed(base.jobDescription ? parseJobDescription(base.jobDescription) : null)
    setAppliedFields([])
    setShowDetails(Boolean(existing))
  }, [open, existing, prefill])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const preview = React.useMemo(
    () =>
      computeFit(
        {
          role: form.role || 'Untitled role',
          company: form.company,
          jobDescription: form.jobDescription,
          location: form.location,
          workArrangement: form.workArrangement,
          salaryMin: toNumber(form.salaryMin),
          salaryMax: toNumber(form.salaryMax),
          currency: form.currency,
          tags: form.tags,
        },
        profile,
      ),
    [form, profile],
  )

  const duplicates = React.useMemo(
    () =>
      findDuplicates(
        opportunities,
        { company: form.company, role: form.role, jobUrl: form.jobUrl },
        existing?.id,
      ),
    [opportunities, form.company, form.role, form.jobUrl, existing?.id],
  )

  const onUrlBlur = () => {
    const normalized = normalizeUrl(form.jobUrl)
    if (!normalized) return
    const guess = guessFromUrl(normalized)
    setForm((f) => ({
      ...f,
      jobUrl: normalized,
      company: f.company || (guess.company ?? ''),
      role: f.role || (guess.role ?? ''),
    }))
  }

  const applyParsed = (text: string) => {
    const result = parseJobDescription(text)
    setParsed(result)
    if (result.wordCount < 12) return
    const { next, applied } = mergeParsedIntoForm(form, result)
    setForm(next)
    setAppliedFields(applied)
    if (applied.length > 0) setShowDetails(true)
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.company.trim()) next.company = 'Company is required.'
    if (!form.role.trim()) next.role = 'Role is required.'
    if (form.jobUrl.trim() && !normalizeUrl(form.jobUrl)) next.jobUrl = 'That does not look like a web address.'
    const min = toNumber(form.salaryMin)
    const max = toNumber(form.salaryMax)
    if (min && max && min > max) next.salaryMax = 'Maximum must be at least the minimum.'
    if (form.nextAction.trim() && !form.nextActionDate) next.nextActionDate = 'Give the next action a date so it can be surfaced.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const buildPayload = (): NewOpportunity => ({
    company: form.company.trim(),
    role: form.role.trim(),
    jobUrl: normalizeUrl(form.jobUrl),
    location: form.location.trim() || undefined,
    workArrangement: form.workArrangement,
    salaryMin: toNumber(form.salaryMin),
    salaryMax: toNumber(form.salaryMax),
    currency: form.currency,
    source: form.source.trim() || undefined,
    stage: form.stage,
    priority: form.priority,
    tags: form.tags,
    dateDiscovered: form.dateDiscovered || today(),
    dateApplied: form.dateApplied || undefined,
    deadline: form.deadline || undefined,
    nextAction: form.nextAction.trim() || undefined,
    nextActionDate: form.nextActionDate || undefined,
    whyInterested: form.whyInterested.trim() || undefined,
    jobDescription: form.jobDescription.trim() || undefined,
  })

  const save = async (andAnother: boolean) => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = buildPayload()
      if (existing) {
        await updateOpportunity(existing.id, payload)
        toast.success('Opportunity updated')
        onOpenChange(false)
      } else {
        const created = await createOpportunity(payload)
        toast.success(`Added ${created.role}`, created.company)
        if (andAnother) {
          setForm({ ...emptyForm(), source: form.source, stage: form.stage })
          setParsed(null)
          setAppliedFields([])
          setShowDetails(false)
          companyRef.current?.focus()
        } else {
          onOpenChange(false)
        }
      }
    } catch (error) {
      toast.error(
        'Could not save this opportunity',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      )
    } finally {
      setSaving(false)
    }
  }

  const mod = isMac() ? '⌘' : 'Ctrl'

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? 'Edit opportunity' : 'Add opportunity'}
      description={
        existing
          ? undefined
          : 'Company and role are all you need. Everything else can wait until you know more.'
      }
      size="lg"
      initialFocusRef={companyRef}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <p className="hidden items-center gap-1.5 text-xs text-faint sm:flex">
            <Kbd>{mod}</Kbd>
            <Kbd>↵</Kbd>
            to save
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            {!existing && (
              <Button variant="secondary" onClick={() => save(true)} disabled={saving}>
                Save and add another
              </Button>
            )}
            <Button variant="primary" onClick={() => save(false)} loading={saving}>
              {existing ? 'Save changes' : 'Add opportunity'}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            void save(false)
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company" required htmlFor="company" error={errors.company}>
            <Input
              id="company"
              ref={companyRef}
              value={form.company}
              onChange={(e) => update('company', e.target.value)}
              placeholder="Halcyon Pay"
              autoComplete="off"
              invalid={Boolean(errors.company)}
            />
          </Field>
          <Field label="Role" required htmlFor="role" error={errors.role}>
            <Input
              id="role"
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
              placeholder="Senior Product Manager"
              autoComplete="off"
              invalid={Boolean(errors.role)}
            />
          </Field>
        </div>

        {duplicates.likely.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-md border border-caution/40 bg-caution-soft/60 px-3 py-2.5">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-caution" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                You may already be tracking {duplicates.likely.length === 1 ? 'this' : 'these'}
              </p>
              <ul className="mt-1 space-y-1">
                {duplicates.likely.slice(0, 3).map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                    <span className="truncate">
                      {o.company} · {o.role}
                    </span>
                    <span className="text-faint">{STAGE_META[o.stage].label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        ui.openOpportunity(o.id)
                      }}
                      className="font-medium text-accent hover:underline"
                    >
                      Open instead
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-faint">Saving anyway is fine — sometimes a company posts twice.</p>
            </div>
          </div>
        )}

        {duplicates.likely.length === 0 && duplicates.sameCompany.length > 0 && (
          <p className="text-xs text-muted">
            You already track {duplicates.sameCompany.length} other{' '}
            {duplicates.sameCompany.length === 1 ? 'role' : 'roles'} at{' '}
            <span className="text-fg">{duplicates.sameCompany[0]?.company}</span>.
          </p>
        )}

        <Field
          label="Job posting URL"
          htmlFor="jobUrl"
          error={errors.jobUrl}
          hint="Pasting a link fills in the company and role where they can be read from the address."
        >
          <Input
            id="jobUrl"
            value={form.jobUrl}
            onChange={(e) => update('jobUrl', e.target.value)}
            onBlur={onUrlBlur}
            placeholder="https://careers.example.com/jobs/senior-pm"
            inputMode="url"
            autoComplete="off"
            prefixNode={<Link2 />}
            invalid={Boolean(errors.jobUrl)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr] sm:items-end">
          <Field label="Stage">
            <StagePicker stage={form.stage} onChange={(s) => update('stage', s)} />
          </Field>
          <Field label="Priority">
            <PriorityPicker priority={form.priority} onChange={(p) => update('priority', p)} />
          </Field>
          {/* A score before the role is typed would be meaningless. */}
          {preview.score !== null && form.role.trim().length > 2 && (
            <div className="flex items-center justify-start gap-2 pb-1 sm:justify-end">
              <span className="text-xs text-muted">Fit preview</span>
              <FitScore fit={preview} showBand />
            </div>
          )}
        </div>

        <JobDescriptionField
          value={form.jobDescription}
          onChange={(value) => update('jobDescription', value)}
          onParse={applyParsed}
          parsed={parsed}
          appliedFields={appliedFields}
          tags={form.tags}
          onAddTag={(tag) => update('tags', uniq([...form.tags, tag]))}
        />

        <div>
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            aria-expanded={showDetails}
            className="flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showDetails && 'rotate-180')} aria-hidden />
            {showDetails ? 'Hide details' : 'Add details'}
          </button>
        </div>

        {showDetails && (
          <div className="space-y-4 border-t border-line pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Location" htmlFor="location" hint={appliedFields.includes('Location') ? 'Read from the description' : undefined}>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="New York, NY"
                  autoComplete="off"
                />
              </Field>
              <Field label="Work arrangement" hint={appliedFields.includes('Work arrangement') ? 'Read from the description' : undefined}>
                <Select<WorkArrangement>
                  ariaLabel="Work arrangement"
                  value={form.workArrangement}
                  onChange={(v) => update('workArrangement', v)}
                  options={WORK_ARRANGEMENTS.map((a) => ({ value: a, label: WORK_ARRANGEMENT_LABEL[a] }))}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_7rem]">
              <Field label="Salary minimum" htmlFor="salaryMin" hint={appliedFields.includes('Compensation') ? 'Read from the description' : undefined}>
                <Input
                  id="salaryMin"
                  value={form.salaryMin}
                  onChange={(e) => update('salaryMin', e.target.value)}
                  placeholder="180000"
                  inputMode="numeric"
                  className="tnum"
                />
              </Field>
              <Field label="Salary maximum" htmlFor="salaryMax" error={errors.salaryMax}>
                <Input
                  id="salaryMax"
                  value={form.salaryMax}
                  onChange={(e) => update('salaryMax', e.target.value)}
                  placeholder="210000"
                  inputMode="numeric"
                  className="tnum"
                  invalid={Boolean(errors.salaryMax)}
                />
              </Field>
              <Field label="Currency">
                <Select
                  ariaLabel="Currency"
                  value={form.currency}
                  onChange={(v) => update('currency', v)}
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Source" htmlFor="source">
                <Input
                  id="source"
                  value={form.source}
                  onChange={(e) => update('source', e.target.value)}
                  placeholder="LinkedIn, referral, company site…"
                  list="source-suggestions"
                  autoComplete="off"
                />
                <datalist id="source-suggestions">
                  {uniq([...allSources, ...SOURCE_SUGGESTIONS]).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <Field label="Tags" hint={appliedFields.includes('Tags') ? 'Read from the description' : undefined}>
                <TagInput
                  ariaLabel="Tags"
                  value={form.tags}
                  onChange={(v) => update('tags', v)}
                  suggestions={uniq([...allTags, ...(parsed?.domains ?? [])])}
                  placeholder="Fintech, remote…"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Discovered" htmlFor="dateDiscovered">
                <Input
                  id="dateDiscovered"
                  type="date"
                  value={form.dateDiscovered}
                  onChange={(e) => update('dateDiscovered', e.target.value)}
                />
              </Field>
              <Field label="Applied" htmlFor="dateApplied">
                <Input
                  id="dateApplied"
                  type="date"
                  value={form.dateApplied}
                  onChange={(e) => update('dateApplied', e.target.value)}
                />
              </Field>
              <Field label="Application deadline" htmlFor="deadline">
                <Input
                  id="deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => update('deadline', e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <Field label="Next action" htmlFor="nextAction">
                <Input
                  id="nextAction"
                  value={form.nextAction}
                  onChange={(e) => update('nextAction', e.target.value)}
                  placeholder="Tailor the résumé and submit"
                  autoComplete="off"
                />
              </Field>
              <Field label="Due" htmlFor="nextActionDate" error={errors.nextActionDate}>
                <Input
                  id="nextActionDate"
                  type="date"
                  value={form.nextActionDate}
                  onChange={(e) => update('nextActionDate', e.target.value)}
                  invalid={Boolean(errors.nextActionDate)}
                />
              </Field>
            </div>

            <Field label="Why I'm interested" htmlFor="whyInterested">
              <Textarea
                id="whyInterested"
                value={form.whyInterested}
                onChange={(e) => update('whyInterested', e.target.value)}
                placeholder="What makes this worth your time?"
                rows={2}
              />
            </Field>
          </div>
        )}
      </form>
    </Modal>
  )
}

/**
 * Fills empty fields from a parsed description and reports which ones changed.
 * Pure, so it can be called from an event handler without hiding side effects
 * inside a state updater — React can call updaters more than once.
 */
function mergeParsedIntoForm(
  form: FormState,
  parsed: ParsedJobDescription,
): { next: FormState; applied: string[] } {
  const next = { ...form }
  const applied: string[] = []

  if (!form.location && parsed.location) {
    next.location = parsed.location
    applied.push('Location')
  }
  if (form.workArrangement === 'unknown' && parsed.arrangement) {
    next.workArrangement = parsed.arrangement
    applied.push('Work arrangement')
  }
  if (!form.salaryMin && !form.salaryMax && parsed.salary) {
    const annual = annualize(parsed.salary)
    if (annual.min) next.salaryMin = String(annual.min)
    if (annual.max) next.salaryMax = String(annual.max)
    next.currency = parsed.salary.currency
    applied.push('Compensation')
  }
  if (form.tags.length === 0 && parsed.domains.length > 0) {
    next.tags = parsed.domains.slice(0, 3)
    applied.push('Tags')
  }
  return { next, applied }
}

function normalizePrefill(prefill: Partial<NewOpportunity> | undefined): Partial<FormState> {
  if (!prefill) return {}
  return {
    company: prefill.company ?? '',
    role: prefill.role ?? '',
    jobUrl: prefill.jobUrl ?? '',
    stage: prefill.stage ?? 'saved',
    priority: prefill.priority ?? 'medium',
    source: prefill.source ?? '',
    tags: prefill.tags ?? [],
  }
}

/* ---------------------- Job description + local parsing -------------------- */

function JobDescriptionField({
  value,
  onChange,
  onParse,
  parsed,
  appliedFields,
  tags,
  onAddTag,
}: {
  value: string
  onChange: (value: string) => void
  onParse: (text: string) => void
  parsed: ParsedJobDescription | null
  appliedFields: string[]
  tags: string[]
  onAddTag: (tag: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const hasFindings =
    parsed &&
    (parsed.salary ||
      parsed.years ||
      parsed.location ||
      parsed.arrangement ||
      parsed.requiredSkills.length > 0 ||
      parsed.preferredSkills.length > 0 ||
      parsed.domains.length > 0)

  return (
    <div className="space-y-2">
      <Field
        label="Job description"
        htmlFor="jobDescription"
        hint="Paste the posting. Opportunity OS reads it with plain text matching on this device — no AI, no upload."
      >
        <Textarea
          id="jobDescription"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (text.length > 120) {
              e.preventDefault()
              onChange(text)
              onParse(text)
              setExpanded(true)
            }
          }}
          onBlur={() => value.trim().length > 120 && onParse(value)}
          placeholder="Paste the full job description here…"
          rows={expanded ? 8 : 3}
          className="font-normal"
        />
      </Field>

      {hasFindings && parsed && (
        <div className="rounded-lg border border-line bg-subtle/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-fg">
              <TextSearch className="h-3.5 w-3.5 text-muted" aria-hidden />
              Read from the description
            </p>
            <span className="shrink-0 text-2xs text-faint">{parsed.wordCount.toLocaleString()} words scanned</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Suggestions from pattern matching — check them before saving.
            {appliedFields.length > 0 && (
              <>
                {' '}
                <span className="text-fg">{appliedFields.join(', ')}</span> {appliedFields.length === 1 ? 'was' : 'were'}{' '}
                filled in below.
              </>
            )}
          </p>

          <dl className="mt-2.5 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            {parsed.salary && (
              <Finding
                label="Compensation"
                value={`${parsed.salary.currency} ${parsed.salary.min?.toLocaleString() ?? '?'}${parsed.salary.max ? `–${parsed.salary.max.toLocaleString()}` : ''} / ${parsed.salary.period}`}
                evidence={parsed.salary.evidence}
              />
            )}
            {parsed.years && (
              <Finding
                label="Experience asked for"
                value={`${parsed.years.min}${parsed.years.max ? `–${parsed.years.max}` : '+'} years`}
                evidence={parsed.years.evidence}
              />
            )}
            {parsed.location && <Finding label="Location" value={parsed.location} />}
            {parsed.arrangement && (
              <Finding label="Work arrangement" value={WORK_ARRANGEMENT_LABEL[parsed.arrangement]} />
            )}
          </dl>

          {(parsed.requiredSkills.length > 0 || parsed.preferredSkills.length > 0 || parsed.domains.length > 0) && (
            <div className="mt-2.5 space-y-2 border-t border-line pt-2.5">
              <ChipRow label="Required" items={parsed.requiredSkills} tags={tags} onAdd={onAddTag} />
              <ChipRow label="Preferred" items={parsed.preferredSkills} tags={tags} onAdd={onAddTag} />
              <ChipRow label="Domain" items={parsed.domains} tags={tags} onAdd={onAddTag} />
              <ChipRow label="Tools" items={parsed.tools} tags={tags} onAdd={onAddTag} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Finding({ label, value, evidence }: { label: string; value: string; evidence?: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-sm font-medium text-fg" title={evidence ? `Matched: “${evidence}”` : value}>
        {value}
      </dd>
    </div>
  )
}

function ChipRow({
  label,
  items,
  tags,
  onAdd,
}: {
  label: string
  items: string[]
  tags: string[]
  onAdd: (tag: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="flex gap-2">
      <span className="mt-1 w-14 shrink-0 text-2xs uppercase tracking-wide text-faint">{label}</span>
      <div className="flex min-w-0 flex-wrap gap-1">
        {items.map((item) => {
          const added = tags.some((t) => t.toLowerCase() === item.toLowerCase())
          return (
            <button
              key={item}
              type="button"
              disabled={added}
              onClick={() => onAdd(item)}
              title={added ? `${item} is already a tag` : `Add ${item} as a tag`}
              className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-px text-2xs font-medium transition-colors',
                added
                  ? 'cursor-default border-accent/25 bg-accent-soft text-accent'
                  : 'border-line bg-panel text-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {item}
              {!added && <Plus className="h-2.5 w-2.5 opacity-70" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
