import * as React from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import {
  Scale,
  Archive,
  ArchiveRestore,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  PenLine,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { Sheet } from '@/components/ui/overlay'
import { Button, Badge, EmptyState, IconButton, Separator } from '@/components/ui/primitives'
import {
  ConfirmDialog,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@/components/ui/overlay'
import { Field, Input, Select } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { CompanyMark, DueDate, FitBreakdown, PriorityPicker, StagePicker } from '@/components/common'
import { EditBlock, InlineDate, InlineInput, InlineTextArea } from './InlineEdit'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import {
  archiveOpportunities,
  completeNextAction,
  deleteOpportunities,
  updateContact,
  updateOpportunity,
} from '@/lib/repo'
import { EVENT_LABEL } from '@/lib/repo'
import {
  INTERVIEW_TYPE_META,
  OFFER_STATUSES,
  RELATIONSHIP_META,
  STAGE_META,
  WORK_ARRANGEMENT_LABEL,
  type Contact,
  type OfferStatus,
  type Opportunity,
} from '@/lib/types'
import { parseJobDescription } from '@/lib/parse'
import { computeOfferValue } from '@/lib/offers'
import {
  cn,
  formatAgo,
  formatDate,
  formatDateTime,
  formatMoney,
  formatSalaryRange,
  hostnameOf,
  today,
} from '@/lib/utils'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'description', label: 'Description' },
  { id: 'people', label: 'People' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
] as const

export function OpportunityPanel() {
  const ui = useAppUi()
  const workspace = useWorkspace()
  const opportunity = ui.openedOpportunityId ? workspace.byId.get(ui.openedOpportunityId) : undefined
  const open = Boolean(ui.openedOpportunityId)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && ui.closeOpportunity()}
      title={opportunity ? `${opportunity.role} at ${opportunity.company}` : 'Opportunity'}
      width="xl"
    >
      {opportunity ? (
        <PanelBody key={opportunity.id} opportunity={opportunity} />
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-end border-b border-line px-3">
            <IconButton label="Close panel" onClick={() => ui.closeOpportunity()}>
              <X />
            </IconButton>
          </div>
          <EmptyState
            className="flex-1"
            title="This opportunity is no longer here"
            description="It may have been deleted in another tab. Close this panel to return to your list."
            action={<Button onClick={() => ui.closeOpportunity()}>Close</Button>}
          />
        </div>
      )}
    </Sheet>
  )
}

function PanelBody({ opportunity }: { opportunity: Opportunity }) {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const fit = workspace.fit.get(opportunity.id) ?? null
  const [tab, setTab] = React.useState<string>(ui.openedTab ?? 'overview')
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const contacts = workspace.contactsByOpportunity.get(opportunity.id) ?? []
  const interviews = workspace.interviewsByOpportunity.get(opportunity.id) ?? []
  const events = workspace.eventsByOpportunity.get(opportunity.id) ?? []

  const patch = (changes: Partial<Opportunity>) => void updateOpportunity(opportunity.id, changes)

  const archive = async () => {
    const undo = await archiveOpportunities([opportunity.id], !opportunity.archivedAt)
    toast.undoable(opportunity.archivedAt ? 'Restored from archive' : 'Opportunity archived', undo.undo)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-line">
        <div className="flex items-start gap-3 px-4 pt-3.5">
          <CompanyMark company={opportunity.company} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-muted">{opportunity.company}</p>
              {opportunity.archivedAt && <Badge tone="neutral">Archived</Badge>}
            </div>
            <h2 className="mt-0.5 text-balance text-lg font-semibold leading-snug tracking-[-0.012em] text-fg">
              {opportunity.role}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {opportunity.jobUrl && (
              <Tooltip content={`Open posting on ${hostnameOf(opportunity.jobUrl) ?? 'the web'}`}>
                <a
                  href={opportunity.jobUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 text-sm font-medium text-fg shadow-xs transition-colors hover:bg-subtle"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">Posting</span>
                </a>
              </Tooltip>
            )}
            <Menu>
              <MenuTrigger asChild>
                <IconButton label="Opportunity actions">
                  <MoreHorizontal />
                </IconButton>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Pencil />} onSelect={() => ui.openEditOpportunity(opportunity)}>
                  Edit all fields
                </MenuItem>
                <MenuItem
                  icon={<Copy />}
                  onSelect={() =>
                    ui.openAddOpportunity({
                      company: opportunity.company,
                      role: opportunity.role,
                      jobUrl: opportunity.jobUrl,
                      tags: opportunity.tags,
                      source: opportunity.source,
                    })
                  }
                >
                  Duplicate
                </MenuItem>
                <MenuItem
                  icon={<CalendarPlus />}
                  onSelect={() => ui.openInterviewEditor({ opportunityId: opportunity.id })}
                >
                  Schedule interview
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={opportunity.archivedAt ? <ArchiveRestore /> : <Archive />}
                  onSelect={() => void archive()}
                >
                  {opportunity.archivedAt ? 'Restore from archive' : 'Archive'}
                </MenuItem>
                <MenuItem icon={<Trash2 />} destructive onSelect={() => setConfirmDelete(true)}>
                  Delete permanently
                </MenuItem>
              </MenuContent>
            </Menu>
            <IconButton label="Close panel" onClick={() => ui.closeOpportunity()}>
              <X />
            </IconButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <StagePicker stage={opportunity.stage} onChange={(stage) => patch({ stage })} />
          <PriorityPicker priority={opportunity.priority} onChange={(priority) => patch({ priority })} />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-panel px-2 text-sm shadow-xs transition-colors hover:bg-subtle"
                aria-label="Fit score details"
              >
                <span className="text-xs text-muted">Fit</span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    fit?.tone === 'positive'
                      ? 'text-positive'
                      : fit?.tone === 'accent'
                        ? 'text-accent'
                        : fit?.tone === 'caution'
                          ? 'text-caution'
                          : fit?.tone === 'critical'
                            ? 'text-critical'
                            : 'text-faint',
                  )}
                >
                  {fit?.score ?? '—'}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(30rem,calc(100vw-2rem))]">
              {fit && <FitBreakdown fit={fit} />}
            </PopoverContent>
          </Popover>

          {/* Hidden on narrow screens, where the meta row wraps and a lone
              divider would dangle at the end of a line. */}
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />

          <MetaItem label="Compensation">
            {formatSalaryRange(opportunity.salaryMin, opportunity.salaryMax, opportunity.currency)}
          </MetaItem>
          <MetaItem label="Location">
            {opportunity.location || WORK_ARRANGEMENT_LABEL[opportunity.workArrangement]}
            {opportunity.location && opportunity.workArrangement !== 'unknown' && (
              <span className="text-faint"> · {WORK_ARRANGEMENT_LABEL[opportunity.workArrangement]}</span>
            )}
          </MetaItem>
          {opportunity.source && <MetaItem label="Source">{opportunity.source}</MetaItem>}
          <MetaItem label={opportunity.dateApplied ? 'Applied' : 'Discovered'}>
            {formatDate(opportunity.dateApplied ?? opportunity.dateDiscovered)}
          </MetaItem>
        </div>
      </header>

      <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List
          className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-3 no-scrollbar"
          aria-label="Opportunity sections"
        >
          {TABS.map((t) => {
            const count =
              t.id === 'people' ? contacts.length : t.id === 'interviews' ? interviews.length : undefined
            return (
              <Tabs.Trigger
                key={t.id}
                value={t.id}
                className={cn(
                  'relative shrink-0 whitespace-nowrap px-2.5 py-2 text-sm font-medium text-muted transition-colors',
                  'hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  'data-[state=active]:text-fg',
                  'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-accent',
                )}
              >
                {t.label}
                {count !== undefined && count > 0 && (
                  <span className="ml-1.5 text-2xs tabular-nums text-faint">{count}</span>
                )}
              </Tabs.Trigger>
            )
          })}
        </Tabs.List>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Tabs.Content value="overview" className="p-4 focus-visible:outline-none">
            <OverviewTab opportunity={opportunity} />
          </Tabs.Content>
          <Tabs.Content value="description" className="p-4 focus-visible:outline-none">
            <DescriptionTab opportunity={opportunity} />
          </Tabs.Content>
          <Tabs.Content value="people" className="p-4 focus-visible:outline-none">
            <PeopleTab opportunity={opportunity} contacts={contacts} />
          </Tabs.Content>
          <Tabs.Content value="interviews" className="p-4 focus-visible:outline-none">
            <InterviewsTab opportunity={opportunity} />
          </Tabs.Content>
          <Tabs.Content value="notes" className="p-4 focus-visible:outline-none">
            <EditBlock label="Notes" hint="Autosaves when you click away.">
              <InlineTextArea
                label="Notes"
                value={opportunity.notes}
                onCommit={(notes) => patch({ notes })}
                placeholder="Anything worth remembering: recruiter comments, salary signals, people to reach, questions to ask…"
                rows={12}
              />
            </EditBlock>
          </Tabs.Content>
          <Tabs.Content value="activity" className="p-4 focus-visible:outline-none">
            <ActivityTab events={events} />
          </Tabs.Content>
        </div>
      </Tabs.Root>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this opportunity?"
        destructive
        confirmLabel="Delete permanently"
        body={
          <>
            <p>
              <strong className="text-fg">
                {opportunity.role} at {opportunity.company}
              </strong>{' '}
              and its {interviews.length} {interviews.length === 1 ? 'interview' : 'interviews'} and activity
              history will be removed.
            </p>
            <p>Linked contacts are kept, but will no longer reference this opportunity. You can undo this once.</p>
          </>
        }
        onConfirm={async () => {
          const undo = await deleteOpportunities([opportunity.id])
          ui.closeOpportunity()
          toast.undoable('Opportunity deleted', undo.undo, `${opportunity.role} at ${opportunity.company}`)
        }}
      />
    </div>
  )
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5 text-sm">
      <span className="shrink-0 text-xs text-faint">{label}</span>
      <span className="truncate font-medium tabular-nums text-fg">{children}</span>
    </span>
  )
}

/* -------------------------------- Overview -------------------------------- */

function OverviewTab({ opportunity }: { opportunity: Opportunity }) {
  const toast = useToast()
  const workspace = useWorkspace()
  const fit = workspace.fit.get(opportunity.id) ?? null
  const patch = (changes: Partial<Opportunity>) => void updateOpportunity(opportunity.id, changes)

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-subtle/50 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="section-title">Next action</h3>
          <div className="flex items-center gap-2">
            {opportunity.nextActionDate && <DueDate date={opportunity.nextActionDate} className="text-xs" />}
            {opportunity.nextAction && (
              <Button
                size="xs"
                variant="secondary"
                icon={<Check />}
                onClick={async () => {
                  const undo = await completeNextAction(opportunity.id)
                  if (undo) toast.undoable('Marked done', undo.undo, opportunity.nextAction)
                }}
              >
                Mark done
              </Button>
            )}
          </div>
        </div>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-[1fr_9rem]">
          <InlineInput
            label="Next action"
            value={opportunity.nextAction}
            onCommit={(nextAction) => patch({ nextAction })}
            placeholder="What is the single next thing to do?"
            className="text-md font-medium"
          />
          <InlineDate
            label="Next action date"
            value={opportunity.nextActionDate}
            onCommit={(nextActionDate) => patch({ nextActionDate })}
            placeholder="Set a due date"
          />
        </div>
        {!opportunity.nextAction && (
          <p className="mt-1 px-2 text-xs text-faint">
            Opportunities with a dated next action are the ones Today can act on.
          </p>
        )}
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <EditBlock label="Why I'm interested">
          <InlineTextArea
            label="Why I'm interested"
            value={opportunity.whyInterested}
            onCommit={(whyInterested) => patch({ whyInterested })}
            placeholder="What makes this worth pursuing?"
          />
        </EditBlock>
        <EditBlock label="Deadline & dates">
          <div className="space-y-1 px-1">
            <DateRow label="Discovered" value={opportunity.dateDiscovered} onCommit={(v) => patch({ dateDiscovered: v ?? today() })} />
            <DateRow label="Applied" value={opportunity.dateApplied} onCommit={(v) => patch({ dateApplied: v })} />
            <DateRow label="Deadline" value={opportunity.deadline} onCommit={(v) => patch({ deadline: v })} />
          </div>
        </EditBlock>
        <EditBlock label="Strengths">
          <InlineTextArea
            label="Strengths"
            value={opportunity.strengths}
            onCommit={(strengths) => patch({ strengths })}
            placeholder="What makes you a strong candidate here?"
          />
        </EditBlock>
        <EditBlock label="Concerns">
          <InlineTextArea
            label="Concerns"
            value={opportunity.concerns}
            onCommit={(concerns) => patch({ concerns })}
            placeholder="What would make you walk away?"
          />
        </EditBlock>
      </div>

      {(opportunity.stage === 'offer' || opportunity.stage === 'accepted' || opportunity.offer) && (
        <OfferSection opportunity={opportunity} />
      )}
      {(opportunity.stage === 'rejected' || opportunity.rejection) && (
        <RejectionSection opportunity={opportunity} />
      )}

      <section>
        <h3 className="section-title mb-2">Fit score</h3>
        {fit && <FitBreakdown fit={fit} />}
      </section>
    </div>
  )
}

function DateRow({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string | undefined
  onCommit: (value: string | undefined) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
      <InlineDate label={label} value={value} onCommit={onCommit} placeholder="Not set" className="text-sm" />
    </div>
  )
}

function OfferSection({ opportunity }: { opportunity: Opportunity }) {
  const ui = useAppUi()
  const offer = opportunity.offer
  const value = computeOfferValue(offer, opportunity.currency)
  const patch = (changes: Partial<NonNullable<Opportunity['offer']>>) =>
    void updateOpportunity(opportunity.id, {
      offer: { status: 'received', currency: opportunity.currency, ...offer, ...changes },
    })
  const money = (n: number) => formatMoney(Math.round(n), value.currency)

  return (
    <section className="rounded-lg border border-positive/30 bg-positive-soft/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title text-positive">Offer</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={<Scale />} onClick={() => ui.openDecision(opportunity.id)}>
            Decide
          </Button>
          {offer?.decisionDeadline && (
            <span className="text-xs text-muted">
              Decide by <DueDate date={offer.decisionDeadline} className="text-xs" />
            </span>
          )}
          <Select<OfferStatus>
            ariaLabel="Offer status"
            size="sm"
            className="w-36"
            value={offer?.status ?? 'received'}
            onChange={(status) => patch({ status })}
            options={OFFER_STATUSES.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))}
          />
        </div>
      </div>

      {value.usable && (
        <div className="mt-2.5 grid gap-3 rounded-md border border-line bg-panel p-3 sm:grid-cols-3">
          <div>
            <p className="text-2xs uppercase tracking-wide text-faint">First year</p>
            <p className="text-lg font-semibold tabular-nums text-fg">{money(value.firstYear)}</p>
            <p className="text-xs text-faint">Including any sign-on</p>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wide text-faint">Each year after</p>
            <p className="text-lg font-semibold tabular-nums text-fg">{money(value.steadyYear)}</p>
            <p className="text-xs text-faint">Steady state</p>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wide text-faint">Over {value.years} years</p>
            <p className="text-lg font-semibold tabular-nums text-fg">{money(value.total)}</p>
            <p className="text-xs text-faint">Whole package</p>
          </div>
          <div className="sm:col-span-3">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2">
              {value.components.map((component) => (
                <li key={component.label} className="text-xs text-muted">
                  {component.label}{' '}
                  <span className="tabular-nums text-fg">{money(component.total)}</span>
                </li>
              ))}
            </ul>
            {value.missing.length > 0 && (
              <p className="mt-1.5 text-xs text-faint">
                Not counted because it is not recorded: {value.missing.join(', ')}. The totals above are floors.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Base salary">
          <Input
            inputMode="numeric"
            className="tnum h-8"
            defaultValue={offer?.baseSalary ?? ''}
            onBlur={(e) => patch({ baseSalary: toMoney(e.target.value) })}
          />
        </Field>
        <Field label="Target bonus">
          <Input
            inputMode="numeric"
            className="tnum h-8"
            defaultValue={offer?.bonus ?? ''}
            onBlur={(e) => patch({ bonus: toMoney(e.target.value) })}
          />
        </Field>
        <Field label="Sign-on">
          <Input
            inputMode="numeric"
            className="tnum h-8"
            defaultValue={offer?.signOn ?? ''}
            onBlur={(e) => patch({ signOn: toMoney(e.target.value) })}
          />
        </Field>
        <Field label="Decide by">
          <Input
            type="date"
            className="tnum h-8"
            defaultValue={offer?.decisionDeadline ?? ''}
            onBlur={(e) => patch({ decisionDeadline: e.target.value || undefined })}
          />
        </Field>
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_9rem_7rem]">
        <Field label="Equity as described">
          <Input
            className="h-8"
            defaultValue={offer?.equity ?? ''}
            placeholder="0.08% over 4 years"
            onBlur={(e) => patch({ equity: e.target.value.trim() || undefined })}
          />
        </Field>
        <Field label="Estimated value" hint="Leave empty if you cannot value it.">
          <Input
            inputMode="numeric"
            className="tnum h-8"
            defaultValue={offer?.equityValue ?? ''}
            onBlur={(e) => patch({ equityValue: toMoney(e.target.value) })}
          />
        </Field>
        <Field label="Vests over">
          <Input
            inputMode="numeric"
            className="tnum h-8"
            defaultValue={offer?.equityYears ?? ''}
            placeholder="4"
            onBlur={(e) => {
              const years = Number(e.target.value.replace(/[^0-9.]/g, ''))
              patch({ equityYears: Number.isFinite(years) && years > 0 && years <= 10 ? years : undefined })
            }}
          />
        </Field>
      </div>

      <div className="mt-2">
        <InlineTextArea
          label="Offer notes"
          value={offer?.notes}
          onCommit={(notes) => patch({ notes })}
          placeholder="Negotiation notes, competing offers, what you asked for…"
          rows={2}
        />
      </div>
    </section>
  )
}

/** Reads a currency figure typed with or without separators. */
function toMoney(raw: string): number | undefined {
  const n = Number(raw.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}

function RejectionSection({ opportunity }: { opportunity: Opportunity }) {
  const rejection = opportunity.rejection
  const patch = (changes: Partial<NonNullable<Opportunity['rejection']>>) =>
    void updateOpportunity(opportunity.id, { rejection: { ...rejection, ...changes } })

  return (
    <section className="rounded-lg border border-line bg-subtle/60 p-3">
      <h3 className="section-title">Outcome</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <Input
            type="date"
            className="tnum h-8"
            defaultValue={rejection?.date ?? ''}
            onBlur={(e) => patch({ date: e.target.value || undefined })}
          />
        </Field>
        <Field label="Ended at stage">
          <Select
            ariaLabel="Stage the process ended at"
            size="sm"
            value={rejection?.stage ?? opportunity.stage}
            onChange={(stage) => patch({ stage })}
            options={Object.values(STAGE_META)
              .filter((m) => m.active)
              .map((m) => ({ value: m.id, label: m.label }))}
          />
        </Field>
      </div>
      <div className="mt-2">
        <InlineTextArea
          label="What happened"
          value={rejection?.reason}
          onCommit={(reason) => patch({ reason })}
          placeholder="What reason were you given, and what would you do differently?"
          rows={2}
        />
      </div>
    </section>
  )
}

/* ------------------------------- Description ------------------------------ */

function DescriptionTab({ opportunity }: { opportunity: Opportunity }) {
  const parsed = React.useMemo(
    () => (opportunity.jobDescription ? parseJobDescription(opportunity.jobDescription) : null),
    [opportunity.jobDescription],
  )

  return (
    <div className="space-y-4">
      {parsed && parsed.wordCount > 20 && (
        <div className="grid gap-2 rounded-lg border border-line bg-subtle/60 p-3 sm:grid-cols-2">
          <ParsedRow label="Compensation stated" value={
            parsed.salary
              ? `${parsed.salary.currency} ${parsed.salary.min?.toLocaleString() ?? '?'}${parsed.salary.max ? `–${parsed.salary.max.toLocaleString()}` : ''} per ${parsed.salary.period}`
              : 'Not stated'
          } />
          <ParsedRow label="Experience asked for" value={parsed.years ? `${parsed.years.min}+ years` : 'Not stated'} />
          <ParsedRow label="Location" value={parsed.location ?? 'Not stated'} />
          <ParsedRow
            label="Skills named"
            value={
              parsed.requiredSkills.length + parsed.preferredSkills.length > 0
                ? [...parsed.requiredSkills, ...parsed.preferredSkills].slice(0, 8).join(', ')
                : 'None recognised'
            }
          />
        </div>
      )}
      <EditBlock
        label="Job description"
        hint="Stored on this device. Pattern matching reads compensation, experience and skills from it."
      >
        <InlineTextArea
          label="Job description"
          value={opportunity.jobDescription}
          onCommit={(jobDescription) => void updateOpportunity(opportunity.id, { jobDescription })}
          placeholder="Paste the job posting here so it is still available after the listing comes down."
          rows={16}
          className="font-normal text-sm leading-relaxed"
        />
      </EditBlock>
    </div>
  )
}

function ParsedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-2xs uppercase tracking-wide text-faint">{label}</p>
      <p className="truncate text-sm text-fg" title={value}>
        {value}
      </p>
    </div>
  )
}

/* --------------------------------- People --------------------------------- */

function PeopleTab({ opportunity, contacts }: { opportunity: Opportunity; contacts: Contact[] }) {
  const ui = useAppUi()
  const workspace = useWorkspace()
  const [query, setQuery] = React.useState('')

  const linkable = workspace.contacts
    .filter((c) => !c.opportunityIds.includes(opportunity.id))
    .filter((c) =>
      query.trim()
        ? `${c.name} ${c.company ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
        : true,
    )
    .slice(0, 8)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">People at {opportunity.company}</h3>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="secondary" icon={<Plus />}>
                Link contact
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts…"
                aria-label="Search contacts to link"
                className="h-8"
              />
              <div className="mt-1.5 max-h-56 space-y-0.5 overflow-y-auto">
                {linkable.length === 0 ? (
                  <p className="px-2 py-3 text-center text-sm text-faint">No matching contacts.</p>
                ) : (
                  linkable.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        void updateContact(c.id, { opportunityIds: [...c.opportunityIds, opportunity.id] })
                      }
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-subtle"
                    >
                      <span className="min-w-0 flex-1 truncate text-fg">{c.name}</span>
                      <span className="shrink-0 text-2xs text-faint">{RELATIONSHIP_META[c.relationship].label}</span>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            variant="secondary"
            icon={<UserPlus />}
            onClick={() =>
              ui.openContactEditor({
                prefill: { company: opportunity.company, opportunityIds: [opportunity.id] },
              })
            }
          >
            New contact
          </Button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          compact
          icon={<UserPlus />}
          title="No people linked yet"
          description="Track the recruiter, hiring manager or anyone who can refer you. Follow-ups then show up on Today."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 bg-panel px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-medium text-fg">{c.name}</p>
                  <Badge tone={RELATIONSHIP_META[c.relationship].tone}>
                    {RELATIONSHIP_META[c.relationship].label}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {[c.title, c.company].filter(Boolean).join(' · ') || 'No title recorded'}
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-xs text-faint">Last contact</p>
                <p className="text-sm tabular-nums text-muted">{formatDate(c.lastContactDate)}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<PenLine />}
                onClick={() =>
                  ui.openComposer({ kind: 'contact', contactId: c.id, opportunityId: opportunity.id })
                }
              >
                Draft
              </Button>
              <Button size="sm" variant="ghost" onClick={() => ui.openLogTouch(c.id)}>
                Log
              </Button>
              <IconButton
                label={`Unlink ${c.name}`}
                size="sm"
                onClick={() =>
                  void updateContact(c.id, {
                    opportunityIds: c.opportunityIds.filter((id) => id !== opportunity.id),
                  })
                }
              >
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------- Interviews ------------------------------- */

function InterviewsTab({ opportunity }: { opportunity: Opportunity }) {
  const ui = useAppUi()
  const workspace = useWorkspace()
  const interviews = workspace.interviewsByOpportunity.get(opportunity.id) ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">Interviews</h3>
        <Button
          size="sm"
          variant="secondary"
          icon={<CalendarPlus />}
          onClick={() => ui.openInterviewEditor({ opportunityId: opportunity.id })}
        >
          Schedule
        </Button>
      </div>
      {interviews.length === 0 ? (
        <EmptyState
          compact
          icon={<CalendarPlus />}
          title="No interviews scheduled"
          description="Add one to get a prep checklist, expected questions and story suggestions in one place."
        />
      ) : (
        <ul className="space-y-2">
          {interviews.map((iv) => (
            <li key={iv.id}>
              <button
                type="button"
                onClick={() => ui.openInterviewEditor({ interview: iv })}
                className="flex w-full items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2.5 text-left transition-colors hover:bg-subtle"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-fg">
                    {INTERVIEW_TYPE_META[iv.type].label} interview
                  </p>
                  <p className="mt-0.5 text-sm tabular-nums text-muted">{formatDateTime(iv.scheduledAt)}</p>
                </div>
                <Badge
                  tone={
                    iv.outcome === 'advanced'
                      ? 'positive'
                      : iv.outcome === 'rejected'
                        ? 'critical'
                        : iv.outcome === 'pending'
                          ? 'neutral'
                          : 'caution'
                  }
                >
                  {iv.outcome === 'pending' ? 'Awaiting result' : iv.outcome.replace(/_/g, ' ')}
                </Badge>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Open the prep sheet"
                  onClick={(e) => {
                    e.stopPropagation()
                    ui.openPrepSheet(iv.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      ui.openPrepSheet(iv.id)
                    }
                  }}
                  className="shrink-0 rounded-md border border-line bg-panel px-2 py-1 text-xs font-medium text-fg transition-colors hover:bg-subtle"
                >
                  Prep sheet
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* -------------------------------- Activity -------------------------------- */

function ActivityTab({ events }: { events: Array<{ id: string; at: string; type: string; summary: string; detail?: string }> }) {
  if (events.length === 0) {
    return <EmptyState compact title="No activity yet" description="Stage changes, applications and outreach appear here automatically." />
  }
  return (
    <ol className="relative space-y-0 pl-4">
      <span className="absolute bottom-2 left-[5px] top-2 w-px bg-line" aria-hidden />
      {events.map((event) => (
        <li key={event.id} className="relative py-2 pl-4">
          <span className="absolute -left-[calc(1rem-1px)] top-3.5 h-[7px] w-[7px] rounded-full border-2 border-panel bg-line-strong" aria-hidden />
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 text-base text-fg">
              <span className="mr-2 text-2xs uppercase tracking-wide text-faint">
                {EVENT_LABEL[event.type as keyof typeof EVENT_LABEL] ?? 'Event'}
              </span>
              {event.summary}
            </p>
            <time
              dateTime={event.at}
              title={formatDateTime(event.at)}
              className="shrink-0 whitespace-nowrap text-xs tabular-nums text-faint"
            >
              {formatAgo(event.at)}
            </time>
          </div>
          {event.detail && <p className="mt-0.5 text-sm text-muted">{event.detail}</p>}
        </li>
      ))}
    </ol>
  )
}
