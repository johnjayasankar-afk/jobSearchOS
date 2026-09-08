import * as React from 'react'
import { Building2, CheckCheck, Linkedin, Mail, Pencil, PenLine, Plus, Search, Users, X } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { Avatar, Badge, Button, EmptyState, IconButton, Segmented } from '@/components/ui/primitives'
import { Menu, MenuContent, MenuItem, MenuTrigger, Tooltip } from '@/components/ui/overlay'
import { MultiFilter } from '@/components/opportunity/FilterBar'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { useDebounced } from '@/hooks/useHotkeys'
import { RELATIONSHIPS, RELATIONSHIP_META, type Contact, type Relationship } from '@/lib/types'
import { cn, daysFromToday, daysSince, formatDate, normalize, pluralize } from '@/lib/utils'

type ViewId = 'all' | 'follow_up' | 'recruiters' | 'referrals' | 'stale'

const VIEWS: Array<{ id: ViewId; label: string; description: string }> = [
  { id: 'all', label: 'All', description: 'Everyone in your network' },
  { id: 'follow_up', label: 'Needs follow-up', description: 'A follow-up is scheduled for today or earlier' },
  { id: 'recruiters', label: 'Recruiters', description: 'Recruiters and talent partners' },
  { id: 'referrals', label: 'Referrals', description: 'People who can refer you' },
  { id: 'stale', label: 'Gone quiet', description: 'No contact within your stale threshold' },
]

export function ContactsPage() {
  const ui = useAppUi()
  const workspace = useWorkspace()
  const [view, setView] = React.useState<ViewId>('all')
  const [query, setQuery] = React.useState('')
  const [relationships, setRelationships] = React.useState<Relationship[]>([])
  const [groupByCompany, setGroupByCompany] = React.useState(false)
  const debounced = useDebounced(query, 140)

  const staleDays = workspace.settings.staleContactDays

  const filtered = React.useMemo(() => {
    const q = normalize(debounced)
    return workspace.contacts
      .filter((c) => !c.archivedAt)
      .filter((c) => {
        if (relationships.length > 0 && !relationships.includes(c.relationship)) return false
        switch (view) {
          case 'follow_up': {
            const days = daysFromToday(c.nextFollowUpDate)
            return days !== null && days <= 0
          }
          case 'recruiters':
            return c.relationship === 'recruiter'
          case 'referrals':
            return c.relationship === 'referral' || c.relationship === 'alumni' || c.relationship === 'friend'
          case 'stale': {
            const quiet = daysSince(c.lastContactDate)
            return quiet === null || quiet >= staleDays
          }
          default:
            return true
        }
      })
      .filter((c) =>
        q
          ? normalize(
              [c.name, c.company ?? '', c.title ?? '', c.notes ?? '', c.tags.join(' ')].join(' | '),
            ).includes(q)
          : true,
      )
      .sort((a, b) => {
        // Whatever the view, anything with an overdue follow-up comes first.
        const da = daysFromToday(a.nextFollowUpDate)
        const db = daysFromToday(b.nextFollowUpDate)
        const aDue = da !== null && da <= 0 ? 0 : 1
        const bDue = db !== null && db <= 0 ? 0 : 1
        if (aDue !== bDue) return aDue - bDue
        return a.name.localeCompare(b.name)
      })
  }, [workspace.contacts, view, debounced, relationships, staleDays])

  const grouped = React.useMemo(() => {
    if (!groupByCompany) return null
    const map = new Map<string, Contact[]>()
    for (const c of filtered) {
      const key = c.company?.trim() || 'No company'
      const list = map.get(key) ?? []
      list.push(c)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [filtered, groupByCompany])

  const activeView = VIEWS.find((v) => v.id === view)

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Contacts"
        description={activeView?.description}
        actions={
          <>
            <Segmented
              ariaLabel="Grouping"
              size="sm"
              value={groupByCompany ? 'company' : 'list'}
              onChange={(v) => setGroupByCompany(v === 'company')}
              options={[
                { value: 'list', label: <Users className="h-3.5 w-3.5" aria-hidden />, title: 'Flat list' },
                { value: 'company', label: <Building2 className="h-3.5 w-3.5" aria-hidden />, title: 'Group by company' },
              ]}
            />
            <Button size="sm" variant="primary" icon={<Plus />} onClick={() => ui.openContactEditor()}>
              <span className="hidden sm:inline">Add contact</span>
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
          <div className="relative min-w-[11rem] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, companies, notes…"
              aria-label="Search contacts"
              className="h-8 w-full rounded-md border border-line bg-panel pl-8 pr-8 text-base text-fg shadow-xs transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-faint transition-colors hover:bg-subtle hover:text-fg"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Contact views">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  'shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                  view === v.id ? 'bg-subtle text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {v.label}
                {v.id === 'follow_up' && <FollowUpCount />}
              </button>
            ))}
          </div>

          <MultiFilter<Relationship>
            label="Relationship"
            value={relationships}
            onChange={setRelationships}
            options={RELATIONSHIPS.map((r) => ({ value: r, label: RELATIONSHIP_META[r].label }))}
          />

          <p className="ml-auto whitespace-nowrap text-xs tabular-nums text-faint">
            {filtered.length} {pluralize(filtered.length, 'contact')}
          </p>
        </div>
      </PageHeader>

      <p aria-live="polite" className="sr-only">
        {`${filtered.length} ${pluralize(filtered.length, 'contact')} in view`}
      </p>

      {workspace.contacts.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No contacts yet"
          description="Recruiters, hiring managers and people who can refer you. Give each one a follow-up date and Today will remind you."
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => ui.openContactEditor()}>
              Add contact
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="No contacts match"
          description="Try a different view or clear the search."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('')
                setView('all')
                setRelationships([])
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : grouped ? (
        <div>
          {grouped.map(([company, list]) => (
            <section key={company}>
              <h2 className="sticky top-0 z-10 flex items-center gap-2 border-y border-line bg-subtle/90 px-4 py-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted backdrop-blur-sm sm:px-6">
                {company}
                <span className="tabular-nums text-faint">{list.length}</span>
              </h2>
              <ul className="divide-y divide-line">
                {list.map((c) => (
                  <ContactRow key={c.id} contact={c} staleDays={staleDays} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {filtered.map((c) => (
            <ContactRow key={c.id} contact={c} staleDays={staleDays} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FollowUpCount() {
  const { contacts } = useWorkspace()
  const count = contacts.filter((c) => {
    const days = daysFromToday(c.nextFollowUpDate)
    return !c.archivedAt && days !== null && days <= 0
  }).length
  if (count === 0) return null
  return <span className="ml-1.5 rounded bg-critical-soft px-1 text-2xs font-semibold tabular-nums text-critical">{count}</span>
}

function ContactRow({ contact, staleDays }: { contact: Contact; staleDays: number }) {
  const ui = useAppUi()
  const workspace = useWorkspace()
  const followUpDays = daysFromToday(contact.nextFollowUpDate)
  const quiet = daysSince(contact.lastContactDate)
  const isDue = followUpDays !== null && followUpDays <= 0
  const isStale = quiet !== null && quiet >= staleDays

  const linked = contact.opportunityIds
    .map((id) => workspace.byId.get(id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o))

  return (
    <li className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60 sm:px-6">
      <Avatar name={contact.name} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={() => ui.openContactEditor({ contact })}
            className="truncate text-base font-medium text-fg hover:underline"
          >
            {contact.name}
          </button>
          <Badge tone={RELATIONSHIP_META[contact.relationship].tone}>
            {RELATIONSHIP_META[contact.relationship].label}
          </Badge>
          {contact.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {[contact.title, contact.company].filter(Boolean).join(' · ') || 'No title recorded'}
        </p>
        {linked.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {linked.slice(0, 3).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => ui.openOpportunity(o.id)}
                className="truncate rounded border border-line bg-subtle px-1.5 py-px text-2xs text-muted transition-colors hover:text-fg"
              >
                {o.company} · {o.role}
              </button>
            ))}
            {linked.length > 3 && <span className="text-2xs text-faint">+{linked.length - 3}</span>}
          </div>
        )}
      </div>

      <div className="hidden w-28 shrink-0 md:block">
        <p className="text-2xs uppercase tracking-wide text-faint">Last contact</p>
        <p className={cn('text-sm tabular-nums', isStale ? 'text-caution' : 'text-muted')}>
          {contact.lastContactDate ? formatDate(contact.lastContactDate) : 'Never'}
          {quiet !== null && quiet > 0 && <span className="text-faint"> · {quiet}d</span>}
        </p>
      </div>

      <div className="hidden w-28 shrink-0 lg:block">
        <p className="text-2xs uppercase tracking-wide text-faint">Follow-up</p>
        <p className={cn('text-sm tabular-nums', isDue ? 'font-medium text-critical' : 'text-muted')}>
          {contact.nextFollowUpDate ? formatDate(contact.nextFollowUpDate) : '—'}
        </p>
      </div>

      {/* Fixed width so the date columns stay aligned whether or not a contact
          has an email address or a LinkedIn profile. */}
      <div className="flex w-[9.25rem] shrink-0 items-center justify-end gap-1">
        {contact.email && (
          <Tooltip content={contact.email}>
            <a
              href={`mailto:${contact.email}`}
              aria-label={`Email ${contact.name}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-subtle hover:text-fg"
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
          </Tooltip>
        )}
        {contact.linkedinUrl && (
          <Tooltip content="Open LinkedIn profile">
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Open ${contact.name} on LinkedIn`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-subtle hover:text-fg"
            >
              <Linkedin className="h-3.5 w-3.5" />
            </a>
          </Tooltip>
        )}
        <Tooltip content={`Draft a follow-up to ${contact.name}`}>
          <button
            type="button"
            aria-label={`Draft a follow-up to ${contact.name}`}
            onClick={() =>
              ui.openComposer({
                kind: 'contact',
                contactId: contact.id,
                opportunityId: contact.opportunityIds[0],
              })
            }
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-subtle hover:text-fg"
          >
            <PenLine className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <Button size="sm" variant="secondary" onClick={() => ui.openLogTouch(contact.id)}>
          Log
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={`Actions for ${contact.name}`} size="sm">
              <span aria-hidden>⋯</span>
            </IconButton>
          </MenuTrigger>
          <MenuContent>
            <MenuItem
              icon={<PenLine />}
              onSelect={() =>
                ui.openComposer({
                  kind: 'contact',
                  contactId: contact.id,
                  opportunityId: contact.opportunityIds[0],
                })
              }
            >
              Draft a follow-up
            </MenuItem>
            <MenuItem icon={<CheckCheck />} onSelect={() => ui.openLogTouch(contact.id)}>
              Log outreach
            </MenuItem>
            <MenuItem icon={<Pencil />} onSelect={() => ui.openContactEditor({ contact })}>
              Edit contact
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </li>
  )
}
