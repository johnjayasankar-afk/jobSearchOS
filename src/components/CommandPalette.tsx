import * as React from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import {
  ClipboardList,
  Ear,
  ArrowRight,
  BookMarked,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CornerDownLeft,
  Download,
  Filter,
  Moon,
  PenLine,
  Plus,
  Search,
  Sun,
  Undo2,
  UserPlus,
  Users,
} from 'lucide-react'
import { NAV_ITEMS } from './layout/nav'
import { Kbd } from './ui/primitives'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { usePreferences } from '@/state/preferences'
import { useUndo } from '@/state/undo'
import { useToast } from './ui/toast'
import { searchableText } from '@/lib/filtering'
import { buildWorkspaceExport, downloadFile, markBackupTaken, timestampedFilename } from '@/lib/backup'
import { buildIcs } from '@/lib/calendar'
import { INTERVIEW_TYPE_META, RELATIONSHIP_META, STAGE_META } from '@/lib/types'
import { fuzzyScore, highlightSegments } from '@/lib/fuzzy'
import { debriefIsDue } from '@/lib/rehearsal'
import { cn, formatDate, normalize, truncate } from '@/lib/utils'

type ResultGroup = 'Actions' | 'Undo' | 'Opportunities' | 'Contacts' | 'Interviews' | 'Stories' | 'Go to'

interface Result {
  id: string
  group: ResultGroup
  title: string
  subtitle?: string
  icon: React.ReactNode
  /** Extra text matched by the query but not displayed. */
  haystack: string
  run: () => void
  shortcut?: string
  /** Positions in the title that matched, for highlighting. */
  highlight?: number[]
}

const GROUP_ORDER: ResultGroup[] = [
  'Actions',
  'Undo',
  'Opportunities',
  'Contacts',
  'Interviews',
  'Stories',
  'Go to',
]

export function CommandPalette() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const { set, isDark } = usePreferences()
  const undo = useUndo()
  const [query, setQuery] = React.useState('')
  const [cursor, setCursor] = React.useState(0)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (ui.paletteOpen) {
      setQuery('')
      setCursor(0)
    }
  }, [ui.paletteOpen])

  const close = React.useCallback(() => ui.setPaletteOpen(false), [ui])

  const results = React.useMemo<Result[]>(() => {
    const items: Result[] = []

    items.push(
      {
        id: 'act-add',
        group: 'Actions',
        title: 'Add opportunity',
        icon: <Plus className="h-4 w-4" />,
        haystack: 'new job role create capture',
        shortcut: 'N',
        run: () => {
          close()
          ui.openAddOpportunity()
        },
      },
      {
        id: 'act-contact',
        group: 'Actions',
        title: 'Add contact',
        icon: <UserPlus className="h-4 w-4" />,
        haystack: 'new person recruiter referral network',
        run: () => {
          close()
          ui.openContactEditor()
        },
      },
      {
        id: 'act-interview',
        group: 'Actions',
        title: 'Schedule interview',
        icon: <CalendarClock className="h-4 w-4" />,
        haystack: 'new interview prep schedule',
        run: () => {
          close()
          ui.openInterviewEditor({})
        },
      },
      {
        id: 'act-story',
        group: 'Actions',
        title: 'Write a story',
        icon: <BookMarked className="h-4 w-4" />,
        haystack: 'new story star behavioural behavioral',
        run: () => {
          close()
          ui.openStoryEditor()
        },
      },
      {
        id: 'act-theme',
        group: 'Actions',
        title: isDark ? 'Switch to the light theme' : 'Switch to the dark theme',
        icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        haystack: 'theme dark light appearance colour color',
        run: () => {
          set('theme', isDark ? 'light' : 'dark')
          close()
        },
      },
      {
        id: 'act-draft',
        group: 'Actions',
        title: 'Draft a follow-up',
        icon: <PenLine className="h-4 w-4" />,
        haystack: 'follow up template message email write compose thank you',
        run: () => {
          close()
          const contact = [...workspace.contacts]
            .filter((c) => !c.archivedAt)
            .sort((a, b) => (a.nextFollowUpDate ?? '9999').localeCompare(b.nextFollowUpDate ?? '9999'))[0]
          if (contact) {
            ui.openComposer({ kind: 'contact', contactId: contact.id, opportunityId: contact.opportunityIds[0] })
          } else {
            toast.toast({
              title: 'No contacts yet',
              description: 'Add a contact and the composer can draft a note to them.',
            })
          }
        },
      },
      {
        id: 'act-debrief',
        group: 'Actions',
        title: 'Debrief a recent interview',
        icon: <ClipboardList className="h-4 w-4" />,
        haystack: 'debrief post interview questions asked review what they asked',
        run: () => {
          close()
          // The most recent interview still inside the window is the one worth
          // writing up; anything older has already faded.
          const due = workspace.interviews
            .filter((iv) => debriefIsDue(iv))
            .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0]
          const fallback = workspace.interviews
            .filter((iv) => new Date(iv.scheduledAt).getTime() <= Date.now())
            .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0]
          const target = due ?? fallback
          if (target) ui.openDebrief(target.id)
          else
            toast.toast({
              title: 'No past interviews yet',
              description: 'Once an interview has happened, this is where you write up what they asked.',
            })
        },
      },
      {
        id: 'act-rehearse',
        group: 'Actions',
        title: 'Rehearse interview answers',
        icon: <Ear className="h-4 w-4" />,
        haystack: 'rehearse practice practise stories interview questions out loud drill',
        run: () => {
          close()
          ui.openRehearsal()
        },
      },
      {
        id: 'act-review',
        group: 'Actions',
        title: 'Start the weekly review',
        icon: <CalendarCheck className="h-4 w-4" />,
        haystack: 'weekly review retrospective close the week stalled',
        run: () => {
          close()
          ui.openReview()
        },
      },
      {
        id: 'act-ics',
        group: 'Actions',
        title: 'Export upcoming interviews to calendar',
        icon: <CalendarClock className="h-4 w-4" />,
        haystack: 'calendar ics export interviews schedule',
        run: () => {
          close()
          const upcoming = workspace.interviews.filter(
            (iv) => new Date(iv.scheduledAt).getTime() > Date.now() - 3_600_000,
          )
          if (upcoming.length === 0) {
            toast.toast({ title: 'No upcoming interviews to export' })
            return
          }
          const ics = buildIcs(
            upcoming.map((iv) => ({
              interview: iv,
              opportunity: workspace.byId.get(iv.opportunityId),
              interviewerNames: iv.contactIds
                .map((id) => workspace.contactsById.get(id)?.name)
                .filter((n): n is string => Boolean(n)),
            })),
          )
          downloadFile(timestampedFilename('interviews', 'ics'), ics, 'text/calendar')
          toast.success(`Exported ${upcoming.length} interviews`)
        },
      },
      {
        id: 'act-export',
        group: 'Actions',
        title: 'Export workspace backup',
        icon: <Download className="h-4 w-4" />,
        haystack: 'backup json download save data export',
        run: () => {
          close()
          void buildWorkspaceExport().then(async (payload) => {
            downloadFile(
              timestampedFilename('opportunity-os-workspace', 'json'),
              JSON.stringify(payload, null, 2),
              'application/json',
            )
            await markBackupTaken()
            toast.success('Workspace exported')
          })
        },
      },
    )

    for (const entry of undo.entries.filter((e) => !e.undone).slice(0, 6)) {
      items.push({
        id: `undo-${entry.id}`,
        group: 'Undo',
        title: `Undo: ${entry.label}`,
        subtitle: entry.description,
        icon: <Undo2 className="h-4 w-4" />,
        haystack: `undo revert ${entry.label} ${entry.description ?? ''}`,
        run: () => {
          close()
          void undo.undoById(entry.id).then((done) => {
            if (done) toast.success('Undone', done.label)
          })
        },
      })
    }

    for (const o of workspace.opportunities) {
      items.push({
        id: `op-${o.id}`,
        group: 'Opportunities',
        title: `${o.company} — ${o.role}`,
        subtitle: `${STAGE_META[o.stage].label}${o.location ? ` · ${o.location}` : ''}${o.archivedAt ? ' · archived' : ''}`,
        icon: <Briefcase className="h-4 w-4" />,
        haystack: searchableText(o),
        run: () => {
          close()
          ui.openOpportunity(o.id)
        },
      })
    }

    for (const c of workspace.contacts) {
      items.push({
        id: `ct-${c.id}`,
        group: 'Contacts',
        title: c.name,
        subtitle: [RELATIONSHIP_META[c.relationship].label, c.title, c.company].filter(Boolean).join(' · '),
        icon: <Users className="h-4 w-4" />,
        haystack: normalize([c.name, c.company, c.title, c.notes, c.tags.join(' '), c.email].filter(Boolean).join(' ')),
        run: () => {
          close()
          ui.openContactEditor({ contact: c })
        },
      })
    }

    for (const iv of workspace.interviews) {
      const o = workspace.byId.get(iv.opportunityId)
      items.push({
        id: `iv-${iv.id}`,
        group: 'Interviews',
        title: `${INTERVIEW_TYPE_META[iv.type].label} — ${o?.company ?? 'Unknown'}`,
        subtitle: `${formatDate(iv.scheduledAt)}${o ? ` · ${o.role}` : ''}`,
        icon: <CalendarClock className="h-4 w-4" />,
        haystack: normalize(
          [INTERVIEW_TYPE_META[iv.type].label, o?.company, o?.role, iv.prepNotes, iv.debrief]
            .filter(Boolean)
            .join(' '),
        ),
        run: () => {
          close()
          ui.openInterviewEditor({ interview: iv })
        },
      })
    }

    for (const s of workspace.stories) {
      items.push({
        id: `st-${s.id}`,
        group: 'Stories',
        title: s.title,
        subtitle: s.tags.join(' · ') || 'No themes',
        icon: <BookMarked className="h-4 w-4" />,
        haystack: normalize(
          [s.title, s.situation, s.task, s.action, s.result, s.metrics, s.skills.join(' '), s.tags.join(' ')]
            .filter(Boolean)
            .join(' '),
        ),
        run: () => {
          close()
          ui.openStoryEditor(s)
        },
      })
    }

    const stageShortcuts: Array<{ label: string; stages: string }> = [
      { label: 'Awaiting a reply', stages: 'applied' },
      { label: 'Interviewing now', stages: 'recruiter_screen,hiring_manager,case_technical,onsite,final_round' },
      { label: 'Offers on the table', stages: 'offer,accepted' },
      { label: 'Still to evaluate', stages: 'saved,evaluating' },
    ]
    for (const shortcut of stageShortcuts) {
      items.push({
        id: `filter-${shortcut.stages}`,
        group: 'Go to',
        title: shortcut.label,
        subtitle: 'Filtered opportunities',
        icon: <Filter className="h-4 w-4" />,
        haystack: `${shortcut.label} filter stage opportunities`,
        run: () => {
          close()
          ui.navigateTo(`/opportunities?stage=${shortcut.stages}`)
        },
      })
    }

    for (const item of NAV_ITEMS) {
      items.push({
        id: `nav-${item.to}`,
        group: 'Go to',
        title: item.label,
        icon: <item.icon className="h-4 w-4" />,
        haystack: `${item.label} navigate page`,
        shortcut: `G ${item.sequenceKey.toUpperCase()}`,
        run: () => {
          close()
          ui.navigateTo(item.to)
        },
      })
    }

    return items
  }, [workspace, ui, close, isDark, set, toast, undo])

  const filtered = React.useMemo(() => {
    const q = query.trim()
    if (!q) {
      // With no query, show what is actionable: commands, navigation, anything
      // still undoable, and the records touched most recently.
      const recent = [...workspace.opportunities]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5)
        .map((o) => `op-${o.id}`)
      return results.filter(
        (r) => r.group === 'Actions' || r.group === 'Undo' || r.group === 'Go to' || recent.includes(r.id),
      )
    }
    type Scored = Result & { score: number }
    const scored: Scored[] = []
    for (const r of results) {
      const match = fuzzyScore(q, { title: r.title, subtitle: r.subtitle, keywords: r.haystack })
      if (match) scored.push({ ...r, highlight: match.titleIndices, score: match.score })
    }
    // Ties break towards the shorter label, which is almost always the one meant.
    scored.sort((a, b) => b.score - a.score || a.title.length - b.title.length)
    return scored.slice(0, 40)
  }, [results, query, workspace.opportunities])

  const grouped = React.useMemo(() => {
    const map = new Map<ResultGroup, Result[]>()
    for (const r of filtered) {
      const list = map.get(r.group) ?? []
      list.push(r)
      map.set(r.group, list)
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g) ?? [] }))
  }, [filtered])

  const flat = React.useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  React.useEffect(() => {
    setCursor(0)
  }, [query])

  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${cursor}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => (flat.length === 0 ? 0 : (c + 1) % flat.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => (flat.length === 0 ? 0 : (c - 1 + flat.length) % flat.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      flat[cursor]?.run()
    } else if (event.key === 'Home') {
      event.preventDefault()
      setCursor(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setCursor(Math.max(0, flat.length - 1))
    }
  }

  let index = -1

  return (
    <RDialog.Root open={ui.paletteOpen} onOpenChange={ui.setPaletteOpen}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[60] bg-[hsl(var(--shadow)/0.35)] backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <RDialog.Content
          onKeyDown={onKeyDown}
          className={cn(
            'fixed left-1/2 top-[12vh] z-[61] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2',
            'overflow-hidden rounded-xl border border-line bg-panel shadow-xl',
            'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
          )}
        >
          <RDialog.Title className="sr-only">Search and commands</RDialog.Title>
          <RDialog.Description className="sr-only">
            Search opportunities, contacts, interviews and stories, or run a command. Use the arrow keys to move
            and Enter to open.
          </RDialog.Description>

          <div className="flex items-center gap-2.5 border-b border-line px-3.5">
            <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or run a command…"
              aria-label="Search or run a command"
              aria-controls="command-results"
              aria-activedescendant={flat[cursor] ? `cmd-${flat[cursor].id}` : undefined}
              role="combobox"
              aria-expanded
              className="h-12 min-w-0 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-faint"
            />
            <Kbd>Esc</Kbd>
          </div>

          <div ref={listRef} id="command-results" role="listbox" aria-label="Results" className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
            {flat.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-base text-fg">No matches for “{truncate(query, 40)}”</p>
                <p className="mt-1 text-sm text-muted">
                  Try a company, a person's name, a tag, or part of a note.
                </p>
              </div>
            ) : (
              grouped.map(({ group, items }) => (
                <div key={group} className="mb-1 last:mb-0">
                  <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-[0.06em] text-faint">
                    {group}
                  </p>
                  {items.map((item) => {
                    index += 1
                    const active = index === cursor
                    const myIndex = index
                    return (
                      <button
                        key={item.id}
                        id={`cmd-${item.id}`}
                        data-index={myIndex}
                        role="option"
                        aria-selected={active}
                        onMouseMove={() => setCursor(myIndex)}
                        onClick={item.run}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                          active ? 'bg-subtle' : 'hover:bg-subtle/60',
                        )}
                      >
                        <span className={cn('shrink-0', active ? 'text-fg' : 'text-faint')} aria-hidden>
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base text-fg">
                            {highlightSegments(item.title, item.highlight ?? []).map((segment, i) =>
                              segment.match ? (
                                <mark
                                  key={i}
                                  className="rounded-[2px] bg-accent/20 px-px text-fg [text-decoration:inherit]"
                                >
                                  {segment.text}
                                </mark>
                              ) : (
                                <React.Fragment key={i}>{segment.text}</React.Fragment>
                              ),
                            )}
                          </span>
                          {item.subtitle && (
                            <span className="block truncate text-xs text-muted">{item.subtitle}</span>
                          )}
                        </span>
                        {item.shortcut && <Kbd className="shrink-0">{item.shortcut}</Kbd>}
                        {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-line bg-subtle/60 px-3 py-1.5 text-2xs text-faint">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              open
            </span>
            <span className="ml-auto flex items-center gap-1">
              <ArrowRight className="h-3 w-3" aria-hidden />
              {flat.length} {flat.length === 1 ? 'result' : 'results'}
            </span>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
