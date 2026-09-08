import * as React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  Command,
  Ellipsis,
  Monitor,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react'
import { cn, isMac } from '@/lib/utils'
import { NAV_ITEMS } from './nav'
import { usePreferences, type ThemeMode } from '@/state/preferences'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { buildAgenda } from '@/lib/agenda'
import { STAGE_META } from '@/lib/types'
import { IconButton, Kbd, Segmented } from '@/components/ui/primitives'
import { Tooltip } from '@/components/ui/overlay'
import { useBodyScrollLock, useMediaQuery } from '@/hooks/useHotkeys'
import { AppMark } from './AppMark'

function useNavCounts() {
  const { opportunities, contacts, interviews, stories, settings } = useWorkspace()
  return React.useMemo(() => {
    const agenda = buildAgenda({ opportunities, contacts, interviews, stories, settings })
    const urgent = agenda.filter((a) => a.urgency === 'overdue' || a.urgency === 'today').length
    const active = opportunities.filter((o) => !o.archivedAt && STAGE_META[o.stage].active).length
    const upcomingInterviews = interviews.filter((iv) => {
      const when = new Date(iv.scheduledAt).getTime()
      return when > Date.now() - 3_600_000 && when < Date.now() + 14 * 86_400_000
    }).length
    return {
      '/today': urgent > 0 ? { value: urgent, urgent: true } : null,
      '/opportunities': active > 0 ? { value: active, urgent: false } : null,
      '/interviews': upcomingInterviews > 0 ? { value: upcomingInterviews, urgent: false } : null,
    } as Record<string, { value: number; urgent: boolean } | null>
  }, [opportunities, contacts, interviews, stories, settings])
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { prefs, set } = usePreferences()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const collapsed = prefs.sidebarCollapsed && isDesktop
  const { pathname } = useLocation()
  const mainRef = React.useRef<HTMLElement>(null)

  // The scroll container is <main>, not the window, so changing section has to
  // reset it explicitly — otherwise a new page opens halfway down.
  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-full min-h-0 bg-bg">
      {isDesktop && <Sidebar collapsed={collapsed} onToggle={() => set('sidebarCollapsed', !prefs.sidebarCollapsed)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        {!isDesktop && <MobileTopBar />}
        <main
          id="main"
          ref={mainRef}
          className={cn(
            'relative min-h-0 flex-1 overflow-y-auto',
            !isDesktop && 'pb-[calc(3.5rem+env(safe-area-inset-bottom))]',
          )}
        >
          {children}
        </main>
        {!isDesktop && <MobileTabBar />}
      </div>
    </div>
  )
}

/* -------------------------------- Sidebar --------------------------------- */

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const ui = useAppUi()
  const counts = useNavCounts()
  const { views } = useWorkspace()
  const pinnedViews = views.filter((v) => v.pinned).slice(0, 5)
  const { pathname } = useLocation()
  const mod = isMac() ? '⌘' : 'Ctrl'

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-line bg-subtle/40 transition-[width] duration-200',
        collapsed ? 'w-[56px]' : 'w-[228px]',
      )}
    >
      <div className={cn('flex h-14 items-center gap-2 px-3', collapsed && 'justify-center px-0')}>
        <AppMark className="h-7 w-7 shrink-0" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-[-0.01em] text-fg">Opportunity OS</p>
          </div>
        )}
      </div>

      <div className={cn('px-2.5 pb-2', collapsed && 'px-2')}>
        {collapsed ? (
          <Tooltip content={`Search and commands · ${mod}K`} side="right">
            <button
              type="button"
              onClick={() => ui.setPaletteOpen(true)}
              aria-label="Search and commands"
              className="flex h-8 w-full items-center justify-center rounded-md border border-line bg-panel text-muted shadow-xs transition-colors hover:bg-subtle hover:text-fg"
            >
              <Search className="h-4 w-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => ui.setPaletteOpen(true)}
            className="group flex h-8 w-full items-center gap-2 rounded-md border border-line bg-panel px-2 text-sm text-muted shadow-xs transition-colors hover:border-line-strong hover:bg-panel hover:text-fg"
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="flex-1 text-left">Search…</span>
            <span className="flex items-center gap-0.5">
              <Kbd>{mod}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        )}
      </div>

      <nav className={cn('flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-2', collapsed && 'px-2')} aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const count = counts[item.to]
          // The active state is resolved here rather than through NavLink's
          // render-prop className: when the link is wrapped in a tooltip
          // trigger, Radix merges props and would stringify a function.
          const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`)
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors duration-75',
                collapsed && 'justify-center px-0',
                isActive ? 'bg-panel text-fg shadow-xs ring-1 ring-line' : 'text-muted hover:bg-subtle hover:text-fg',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden strokeWidth={1.9} />
              {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
              {!collapsed && count && (
                <span
                  className={cn(
                    'shrink-0 rounded px-1 text-2xs font-semibold tabular-nums',
                    count.urgent ? 'bg-critical-soft text-critical' : 'text-faint',
                  )}
                >
                  {count.value}
                </span>
              )}
              {collapsed && count?.urgent && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-critical" aria-hidden />
              )}
            </NavLink>
          )
          return collapsed ? (
            <Tooltip key={item.to} content={item.label} side="right">
              {link}
            </Tooltip>
          ) : (
            link
          )
        })}
      </nav>

      {!collapsed && pinnedViews.length > 0 && (
        <div className="border-t border-line px-2.5 py-2">
          <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-[0.06em] text-faint">Views</p>
          {pinnedViews.map((view) => (
            <NavLink
              key={view.id}
              to={`/opportunities?view=${view.id}`}
              className="flex h-7 items-center gap-2.5 rounded-md px-2 text-sm text-muted transition-colors hover:bg-subtle hover:text-fg"
            >
              <Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={1.9} />
              <span className="min-w-0 flex-1 truncate">{view.name}</span>
            </NavLink>
          ))}
        </div>
      )}

      <div className={cn('space-y-2 border-t border-line px-2.5 py-2.5', collapsed && 'px-2')}>
        {collapsed ? (
          <Tooltip content="Add opportunity · N" side="right">
            <button
              type="button"
              onClick={() => ui.openAddOpportunity()}
              aria-label="Add opportunity"
              className="flex h-8 w-full items-center justify-center rounded-md bg-accent text-accent-fg shadow-xs transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => ui.openAddOpportunity()}
            className="flex h-8 w-full items-center gap-2 rounded-md bg-accent px-2 text-sm font-medium text-accent-fg shadow-xs transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left">Add opportunity</span>
            <Kbd className="border-white/25 bg-white/15 text-accent-fg/90">N</Kbd>
          </button>
        )}

        {!collapsed && <ThemeToggle />}
        {!collapsed && <PrivacyNote />}

        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-end')}>
          <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="right">
            <IconButton label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} size="sm" onClick={onToggle}>
              {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { prefs, set } = usePreferences()
  return (
    <Segmented<ThemeMode>
      ariaLabel="Colour theme"
      size="sm"
      className={cn('w-full [&>button]:flex-1', className)}
      value={prefs.theme}
      onChange={(value) => set('theme', value)}
      options={[
        { value: 'light', label: <Sun className="h-3.5 w-3.5" aria-hidden />, title: 'Light' },
        { value: 'dark', label: <Moon className="h-3.5 w-3.5" aria-hidden />, title: 'Dark' },
        { value: 'system', label: <Monitor className="h-3.5 w-3.5" aria-hidden />, title: 'Match system' },
      ]}
    />
  )
}

function PrivacyNote() {
  return (
    <Tooltip
      side="right"
      content="Opportunity OS has no account server and makes no network requests with your data. Everything is stored in this browser."
    >
      <p className="flex cursor-default items-center gap-1.5 px-0.5 text-2xs leading-tight text-faint">
        <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">Stays on this device</span>
      </p>
    </Tooltip>
  )
}

/* --------------------------------- Mobile --------------------------------- */

function MobileTopBar() {
  const ui = useAppUi()

  // The section name belongs to the page header below and the tab bar at the
  // foot of the screen; repeating it here would waste a scarce row.
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur-md">
      <AppMark className="h-7 w-7 shrink-0" />
      <p className="min-w-0 flex-1 truncate text-md font-semibold tracking-[-0.01em] text-fg">
        Opportunity OS
      </p>
      <IconButton label="Search and commands" onClick={() => ui.setPaletteOpen(true)}>
        <Search />
      </IconButton>
      <button
        type="button"
        onClick={() => ui.openAddOpportunity()}
        aria-label="Add opportunity"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg shadow-xs"
      >
        <Plus className="h-4 w-4" />
      </button>
    </header>
  )
}

function MobileTabBar() {
  const [moreOpen, setMoreOpen] = React.useState(false)
  const location = useLocation()
  useBodyScrollLock(moreOpen)

  const primary = NAV_ITEMS.filter((item) => item.primaryMobile)
  const secondary = NAV_ITEMS.filter((item) => !item.primaryMobile)
  const secondaryActive = secondary.some((item) => location.pathname.startsWith(item.to))

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-start border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex h-14 flex-1 flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors',
                isActive ? 'text-accent' : 'text-muted',
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" aria-hidden strokeWidth={1.9} />
            <span className="max-w-full truncate px-1">{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className={cn(
            'flex h-14 flex-1 flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors',
            secondaryActive ? 'text-accent' : 'text-muted',
          )}
        >
          <Ellipsis className="h-[18px] w-[18px]" aria-hidden />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="More sections">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-[hsl(var(--shadow)/0.35)] animate-fade-in"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-2xl border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-md font-semibold text-fg">More</p>
              <IconButton label="Close menu" size="sm" onClick={() => setMoreOpen(false)}>
                <X />
              </IconButton>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {secondary.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg border border-line px-3 py-3 text-base font-medium transition-colors',
                      isActive ? 'bg-accent-soft text-accent' : 'bg-subtle text-fg',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden strokeWidth={1.9} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
            <div className="border-t border-line px-4 py-3">
              <ThemeToggle />
              <p className="mt-2.5 flex items-center gap-1.5 text-2xs text-faint">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Your workspace stays on this device.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function CommandHint() {
  const mod = isMac() ? '⌘' : 'Ctrl'
  return (
    <span className="inline-flex items-center gap-1 text-xs text-faint">
      <Command className="h-3 w-3" aria-hidden />
      {mod}K
    </span>
  )
}
