import * as React from 'react'
import { Keyboard, PenLine, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { Badge, Button, IconButton, Kbd, Segmented, Separator } from '@/components/ui/primitives'
import { Field, Input, Select, Switch, TagInput } from '@/components/ui/form'
import { ThemeToggle } from '@/components/layout/AppShell'
import { DataSection } from '@/components/settings/DataSection'
import { QuestionsSection } from '@/components/settings/QuestionsSection'
import { SafetySection } from '@/components/settings/SafetySection'
import { useWorkspace } from '@/state/workspace'
import { usePreferences } from '@/state/preferences'
import { deleteTemplate, saveCriteria, updateProfile, updateSettings } from '@/lib/repo'
import { APP_VERSION } from '@/lib/backup'
import {
  COMPANY_TYPES,
  SENIORITY_LEVELS,
  SENIORITY_META,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_META,
  type MasterProfile,
  type SeniorityLevel,
  CRITERION_WEIGHTS,
  WEIGHT_META,
  type DecisionCriterion,
} from '@/lib/types'
import { tokensUsed } from '@/lib/templates'
import { useAppUi } from '@/state/app-ui'
import { useToast } from '@/components/ui/toast'
import {
  DOMAIN_SUGGESTIONS,
  ROLE_SUGGESTIONS,
  SKILL_SUGGESTIONS,
  TOOL_SUGGESTIONS,
} from '@/lib/skills-dictionary'
import { CURRENCIES, cn, isMac, newId } from '@/lib/utils'
import { computeFit } from '@/lib/fit'

type SectionId = 'profile' | 'workspace' | 'followups' | 'questions' | 'data' | 'safety' | 'about'

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'profile', label: 'Master Profile' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'questions', label: 'Questions' },
  { id: 'data', label: 'Data' },
  { id: 'safety', label: 'Safety' },
  { id: 'about', label: 'About' },
]

export function SettingsPage() {
  const [section, setSection] = React.useState<SectionId>('profile')

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Settings">
        <div className="px-4 pb-3 sm:px-6">
          <div className="flex gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={section === s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  'shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                  section === s.id ? 'bg-subtle text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {section === 'profile' && <ProfileSection />}
        {section === 'workspace' && <WorkspaceSection />}
        {section === 'followups' && <TemplatesSection />}
        {section === 'questions' && <QuestionsSection />}
        {section === 'data' && <DataSection />}
        {section === 'safety' && <SafetySection />}
        {section === 'about' && <AboutSection />}
      </div>
    </div>
  )
}

/* ------------------------------ Master profile ---------------------------- */

function ProfileSection() {
  const { profile, opportunities } = useWorkspace()
  if (!profile) return null

  const patch = (changes: Partial<MasterProfile>) => void updateProfile(changes)

  // A live sense of what the profile is doing to scores across the workspace.
  const scored = opportunities.filter((o) => computeFit(o, profile).score !== null).length

  return (
    <div className="space-y-7">
      <header>
        <h2 className="text-md font-semibold text-fg">Master Profile</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          This is what fit scoring compares every opportunity against. Nothing here is inferred — a score only
          uses what you enter, and components without data are excluded rather than guessed.
        </p>
        <p className="mt-2 text-xs text-faint">
          {scored} of {opportunities.length} opportunities can currently be scored. Changes save automatically.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="section-title">What you are looking for</h3>
        <Field
          label="Your name"
          htmlFor="profile-name"
          hint="Only used to sign off drafted follow-ups. It never leaves this device."
        >
          <Input
            id="profile-name"
            defaultValue={profile.name ?? ''}
            placeholder="Alex Mercer"
            autoComplete="name"
            onBlur={(e) => patch({ name: e.target.value.trim() || undefined })}
          />
        </Field>
        <Field label="Target role titles" hint="Used for the role-alignment component, worth 25 points.">
          <TagInput
            ariaLabel="Target role titles"
            value={profile.targetRoles}
            onChange={(targetRoles) => patch({ targetRoles })}
            suggestions={ROLE_SUGGESTIONS}
            placeholder="Senior Product Manager…"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seniority">
            <Select<SeniorityLevel | 'unset'>
              ariaLabel="Seniority"
              value={profile.seniority ?? 'unset'}
              onChange={(v) => patch({ seniority: v === 'unset' ? undefined : v })}
              options={[
                { value: 'unset', label: 'Not set' },
                ...SENIORITY_LEVELS.map((s) => ({ value: s, label: SENIORITY_META[s].label })),
              ]}
            />
          </Field>
          <Field label="Years of experience" htmlFor="years">
            <Input
              id="years"
              inputMode="numeric"
              className="tnum"
              defaultValue={profile.yearsExperience ?? ''}
              placeholder="8"
              onBlur={(e) => {
                const value = Number(e.target.value.replace(/[^0-9.]/g, ''))
                patch({ yearsExperience: Number.isFinite(value) && value > 0 ? value : undefined })
              }}
            />
          </Field>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="section-title">What you bring</h3>
        <Field label="Skills" hint="Matched against skills named in a job description, worth 25 points.">
          <TagInput
            ariaLabel="Skills"
            value={profile.skills}
            onChange={(skills) => patch({ skills })}
            suggestions={SKILL_SUGGESTIONS}
            placeholder="SQL, Product Strategy…"
          />
        </Field>
        <Field label="Tools">
          <TagInput
            ariaLabel="Tools"
            value={profile.tools}
            onChange={(tools) => patch({ tools })}
            suggestions={TOOL_SUGGESTIONS}
            placeholder="Amplitude, Figma…"
          />
        </Field>
        <Field label="Domain expertise" hint="Worth 15 points when it overlaps with the role's domain.">
          <TagInput
            ariaLabel="Domain expertise"
            value={profile.domains}
            onChange={(domains) => patch({ domains })}
            suggestions={DOMAIN_SUGGESTIONS}
            placeholder="Fintech, AI…"
          />
        </Field>
        <Field label="Preferred industries">
          <TagInput
            ariaLabel="Preferred industries"
            value={profile.industries}
            onChange={(industries) => patch({ industries })}
            suggestions={DOMAIN_SUGGESTIONS}
          />
        </Field>
        <Field label="Preferred company types">
          <TagInput
            ariaLabel="Preferred company types"
            value={profile.companyTypes}
            onChange={(companyTypes) => patch({ companyTypes })}
            suggestions={[...COMPANY_TYPES]}
          />
        </Field>
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="section-title">Where and for how much</h3>
        <Field label="Preferred locations">
          <TagInput
            ariaLabel="Preferred locations"
            value={profile.locations}
            onChange={(locations) => patch({ locations })}
            placeholder="New York, NY…"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Work arrangement preference">
            <Select
              ariaLabel="Work arrangement preference"
              value={profile.remotePreference}
              onChange={(remotePreference) => patch({ remotePreference })}
              options={[
                { value: 'remote', label: 'Remote' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'onsite', label: 'On-site' },
                { value: 'flexible', label: 'No strong preference' },
              ]}
            />
          </Field>
          <Field label="Open to relocating">
            <label className="flex h-8 items-center gap-2 text-base text-fg">
              <Switch
                checked={profile.willingToRelocate}
                onChange={(willingToRelocate) => patch({ willingToRelocate })}
                ariaLabel="Open to relocating"
              />
              {profile.willingToRelocate ? 'Yes' : 'No'}
            </label>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field label="Minimum total compensation" htmlFor="min-comp" hint="Compared against the top of a stated range.">
            <Input
              id="min-comp"
              inputMode="numeric"
              className="tnum"
              defaultValue={profile.minCompensation ?? ''}
              placeholder="180000"
              onBlur={(e) => {
                const value = Number(e.target.value.replace(/[^0-9]/g, ''))
                patch({ minCompensation: Number.isFinite(value) && value > 0 ? value : undefined })
              }}
            />
          </Field>
          <Field label="Currency">
            <Select
              ariaLabel="Currency"
              value={profile.currency}
              onChange={(currency) => patch({ currency })}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="section-title">Signals you care about</h3>
        <Field label="Words that attract you" hint="Adds to the preferences component when they appear in a posting.">
          <TagInput
            ariaLabel="Desired keywords"
            value={profile.desiredKeywords}
            onChange={(desiredKeywords) => patch({ desiredKeywords })}
            placeholder="platform, 0 to 1…"
          />
        </Field>
        <Field label="Words that put you off" hint="Subtracts from the preferences component when they appear.">
          <TagInput
            ariaLabel="Undesired keywords"
            value={profile.undesiredKeywords}
            onChange={(undesiredKeywords) => patch({ undesiredKeywords })}
            placeholder="five days in office…"
          />
        </Field>
      </section>
    </div>
  )
}

/* ------------------------------- Workspace -------------------------------- */

function WorkspaceSection() {
  const { settings } = useWorkspace()
  const { prefs, set, update } = usePreferences()
  const patch = (changes: Partial<typeof settings>) => void updateSettings(changes)

  const thresholds: Array<{
    key: 'staleOpportunityDays' | 'staleContactDays' | 'applicationFollowUpDays' | 'interviewFollowUpDays'
    label: string
    hint: string
  }> = [
    {
      key: 'applicationFollowUpDays',
      label: 'Follow up on an application after',
      hint: 'Days of silence before Today suggests chasing an application.',
    },
    {
      key: 'interviewFollowUpDays',
      label: 'Interview follow-up overdue after',
      hint: 'Days after an interview before an unsent follow-up is flagged.',
    },
    {
      key: 'staleOpportunityDays',
      label: 'An opportunity is stale after',
      hint: 'Days without any activity before Today asks you to revive or close it.',
    },
    {
      key: 'staleContactDays',
      label: 'A contact has gone quiet after',
      hint: 'Days since the last touch before a contact on a live opportunity resurfaces.',
    },
  ]

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <div>
          <h2 className="text-md font-semibold text-fg">Appearance</h2>
          <p className="mt-1 text-sm text-muted">Stored in this browser, not in your workspace data.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Theme">
            <ThemeToggle className="w-full" />
          </Field>
          <Field label="Table row height">
            <Segmented
              ariaLabel="Table row height"
              className="w-full [&>button]:flex-1"
              value={prefs.density}
              onChange={(density) => set('density', density)}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </Field>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-md font-semibold text-fg">When Today speaks up</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            These thresholds drive the action-priority engine. Every action on Today explains which rule fired.
          </p>
        </div>
        <div className="space-y-3">
          {thresholds.map((threshold) => (
            <div key={threshold.key} className="grid items-center gap-2 sm:grid-cols-[1fr_6rem]">
              <div>
                <label htmlFor={threshold.key} className="text-base text-fg">
                  {threshold.label}
                </label>
                <p className="text-xs text-muted">{threshold.hint}</p>
              </div>
              <Input
                id={threshold.key}
                inputMode="numeric"
                className="tnum"
                defaultValue={settings[threshold.key]}
                onBlur={(e) => {
                  const value = Number(e.target.value.replace(/[^0-9]/g, ''))
                  if (Number.isFinite(value) && value > 0 && value < 3650) patch({ [threshold.key]: value })
                  else e.target.value = String(settings[threshold.key])
                }}
                suffixNode={<span className="text-xs text-faint">days</span>}
              />
            </div>
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <h2 className="text-md font-semibold text-fg">Dismissed notices</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            The backup reminder and the fit-scoring prompt on Today can be dismissed. Bring them back if you
            want them again.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<RotateCcw />}
          onClick={() => update({ backupNudgeDismissedAt: undefined, profileNudgeDismissed: false })}
        >
          Show notices again
        </Button>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-md font-semibold text-fg">Weekly targets</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Shown on Today as a simple progress reading. No streaks, no points.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Applications per week" htmlFor="app-target">
            <Input
              id="app-target"
              inputMode="numeric"
              className="tnum"
              defaultValue={settings.weeklyApplicationTarget}
              onBlur={(e) => {
                const value = Number(e.target.value.replace(/[^0-9]/g, ''))
                if (Number.isFinite(value) && value > 0) patch({ weeklyApplicationTarget: value })
                else e.target.value = String(settings.weeklyApplicationTarget)
              }}
            />
          </Field>
          <Field label="Networking touches per week" htmlFor="net-target">
            <Input
              id="net-target"
              inputMode="numeric"
              className="tnum"
              defaultValue={settings.weeklyNetworkingTarget}
              onBlur={(e) => {
                const value = Number(e.target.value.replace(/[^0-9]/g, ''))
                if (Number.isFinite(value) && value > 0) patch({ weeklyNetworkingTarget: value })
                else e.target.value = String(settings.weeklyNetworkingTarget)
              }}
            />
          </Field>
        </div>
      </section>

      <CriteriaSection />
    </div>
  )
}

/* ---------------------------- Decision criteria --------------------------- */

/**
 * What you want from your next job, written down before an offer is in front of
 * you. Kept here rather than on an offer because it does not change between two
 * of them — and because deciding it under a deadline is how people talk
 * themselves into things.
 */
function CriteriaSection() {
  const { settings } = useWorkspace()
  const toast = useToast()
  const criteria = settings.decisionCriteria ?? []
  const [draft, setDraft] = React.useState('')

  const commit = async (next: DecisionCriterion[], message: string) => {
    const { undo } = await saveCriteria(next)
    toast.undoable(message, undo)
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-[18rem] max-w-2xl flex-1">
          <h2 className="text-md font-semibold text-fg">What matters in a role</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Used when you decide on an offer. Weight each one honestly — if everything is decisive,
            nothing is, and the list stops helping on the day it matters.
          </p>
        </div>
      </div>

      {criteria.length > 0 && (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
          {criteria.map((criterion) => (
            <li
              key={criterion.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-panel px-3.5 py-2.5"
            >
              <span className="min-w-[12rem] flex-1 text-base text-fg">{criterion.label}</span>
              <div
                role="radiogroup"
                aria-label={`How much ${criterion.label} weighs`}
                className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-md border border-line bg-subtle p-0.5"
              >
                {CRITERION_WEIGHTS.map((weight) => {
                  const on = criterion.weight === weight
                  return (
                    <button
                      key={weight}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      title={WEIGHT_META[weight].hint}
                      onClick={() =>
                        void commit(
                          criteria.map((c) => (c.id === criterion.id ? { ...c, weight } : c)),
                          'Weight changed',
                        )
                      }
                      className={cn(
                        'rounded px-2 py-0.5 text-2xs font-medium transition-colors',
                        on ? 'bg-panel text-fg shadow-xs' : 'text-muted hover:text-fg',
                      )}
                    >
                      {WEIGHT_META[weight].label}
                    </button>
                  )
                })}
              </div>
              <IconButton
                label={`Remove "${criterion.label}"`}
                size="sm"
                onClick={() =>
                  void commit(criteria.filter((c) => c.id !== criterion.id), 'Removed')
                }
              >
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !draft.trim()) return
            e.preventDefault()
            void commit([...criteria, { id: newId('dc_'), label: draft.trim(), weight: 2 }], 'Added')
            setDraft('')
          }}
          placeholder="e.g. How close the office is"
          aria-label="Add something that matters"
          className="min-w-[12rem] flex-1"
        />
        <Button
          variant="secondary"
          icon={<Plus />}
          disabled={!draft.trim()}
          onClick={() => {
            void commit([...criteria, { id: newId('dc_'), label: draft.trim(), weight: 2 }], 'Added')
            setDraft('')
          }}
        >
          Add
        </Button>
      </div>
    </section>
  )
}

/* ------------------------------- Follow-ups ------------------------------- */

function TemplatesSection() {
  const { templates } = useWorkspace()
  const ui = useAppUi()
  const toast = useToast()

  const byCategory = TEMPLATE_CATEGORIES.map((category) => ({
    category,
    items: templates.filter((t) => t.category === category).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-md font-semibold text-fg">Follow-up templates</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          The composer drafts a message from one of these and whatever you have recorded about the person and
          the role. Opportunity OS never sends anything — you read it, edit it and copy it out.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" icon={<PenLine />} onClick={() => ui.openComposer()}>
            Open the composer
          </Button>
        </div>
      </header>

      {byCategory.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
          No templates yet. Open the composer to write one.
        </p>
      ) : (
        byCategory.map((group) => (
          <section key={group.category}>
            <h3 className="section-title">{TEMPLATE_CATEGORY_META[group.category].label}</h3>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {group.items.map((template) => (
                <li key={template.id} className="flex items-center gap-3 bg-panel px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-fg">{template.name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {template.subject || template.body.split('\n')[0]}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-2xs text-faint sm:inline">
                    {tokensUsed(template).length} placeholders
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => ui.openComposer(undefined, template.id)}>
                    Edit
                  </Button>
                  <IconButton
                    label={`Delete the ${template.name} template`}
                    size="sm"
                    onClick={async () => {
                      const undo = await deleteTemplate(template.id)
                      toast.undoable('Template deleted', undo.undo, template.name)
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

/* --------------------------------- About ---------------------------------- */

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['⌘', 'K'], label: 'Search and commands' },
  { keys: ['N'], label: 'Add an opportunity' },
  { keys: ['/'], label: 'Focus the search field' },
  { keys: ['⌘', 'Z'], label: 'Undo the last change' },
  { keys: ['G', 'T'], label: 'Go to Today' },
  { keys: ['G', 'O'], label: 'Go to Opportunities' },
  { keys: ['G', 'P'], label: 'Go to Pipeline' },
  { keys: ['G', 'C'], label: 'Go to Contacts' },
  { keys: ['G', 'I'], label: 'Go to Interviews' },
  { keys: ['G', 'S'], label: 'Go to Story Bank' },
  { keys: ['G', 'A'], label: 'Go to Analytics' },
  { keys: ['↑', '↓'], label: 'Move between table rows' },
  { keys: ['↵'], label: 'Open the focused row' },
  { keys: ['X'], label: 'Select the focused row' },
  { keys: ['Space'], label: 'Rehearsal: start or stop the clock' },
  { keys: ['P'], label: 'Rehearsal: peek at your notes' },
  { keys: ['Esc'], label: 'Close a panel or clear a selection' },
  { keys: ['?'], label: 'Show this list' },
]

function AboutSection() {
  const mod = isMac() ? '⌘' : 'Ctrl'

  return (
    <div className="space-y-7">
      <section>
        <div className="flex items-start gap-3 rounded-lg border border-line bg-subtle/60 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-positive" aria-hidden />
          <div>
            <h2 className="text-md font-semibold text-fg">Your workspace stays on this device</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Opportunity OS has no account server and does not transmit your job-search data. Everything you
              enter is stored in this browser's IndexedDB. There is no analytics package, no telemetry and no
              third-party request — the application works with the network switched off.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The trade-off is that clearing site data deletes your workspace. Export a backup from the Data tab
              regularly.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-md font-semibold text-fg">
          <Keyboard className="h-4 w-4 text-muted" aria-hidden />
          Keyboard shortcuts
        </h2>
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.label} className="flex items-center justify-between gap-3 py-0.5">
              <span className="min-w-0 truncate text-base text-muted">{shortcut.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key === '⌘' ? mod : key}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-md font-semibold text-fg">Install as an app</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Opportunity OS is installable. In Chrome or Edge use the install icon in the address bar; on iOS use
          Share → Add to Home Screen. Once installed it opens in its own window and keeps working offline.
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Badge>Version {APP_VERSION}</Badge>
        <Badge tone="positive">No account required</Badge>
        <Badge tone="positive">No network requests</Badge>
        <Badge tone="positive">Works offline</Badge>
      </section>
    </div>
  )
}
