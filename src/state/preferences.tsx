import * as React from 'react'
import { PreferencesContext } from './contexts'
import type { OpportunityColumnId, SortDirection } from '@/lib/types'

/**
 * UI preferences. These live in localStorage rather than IndexedDB because they
 * describe *this browser*, not the workspace — a backup restored on another
 * machine should not drag someone else's column layout along with it.
 */

export type ThemeMode = 'light' | 'dark' | 'system'
export type Density = 'comfortable' | 'compact'

export interface Preferences {
  theme: ThemeMode
  density: Density
  sidebarCollapsed: boolean
  columns: OpportunityColumnId[]
  sortBy: OpportunityColumnId
  sortDir: SortDirection
  pipelineView: 'board' | 'table'
  /** Set once the user has chosen Start Fresh or Explore Demo. */
  onboarded: boolean
  /** Dismissed one-off notices, keyed by id. */
  dismissed: string[]
  /** Snoozes the "export a backup" reminder for a while. */
  backupNudgeDismissedAt?: string
  /** Snoozes the "set up your profile" prompt. */
  profileNudgeDismissed?: boolean
}

/**
 * Chosen so the table fits a 1280px laptop without horizontal scrolling.
 * Location, tags, source and the other date columns are one click away in the
 * view menu, and turning them on is what makes the table scroll.
 */
export const DEFAULT_COLUMNS: OpportunityColumnId[] = [
  'opportunity',
  'stage',
  'priority',
  'fit',
  'compensation',
  'nextAction',
  'updatedAt',
]

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  density: 'comfortable',
  sidebarCollapsed: false,
  columns: DEFAULT_COLUMNS,
  sortBy: 'updatedAt',
  sortDir: 'desc',
  pipelineView: 'board',
  onboarded: false,
  dismissed: [],
}

const PREFS_KEY = 'oos.prefs'
const THEME_KEY = 'oos.theme'

function readPreferences(): Preferences {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Preferences>) : {}
    const theme = localStorage.getItem(THEME_KEY)
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      columns: Array.isArray(parsed.columns) && parsed.columns.length > 0 ? parsed.columns : DEFAULT_COLUMNS,
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
      theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : (parsed.theme ?? 'system'),
    }
  } catch {
    // Corrupt or blocked storage must never prevent the app from starting.
    return DEFAULT_PREFERENCES
  }
}

export interface PreferencesApi {
  prefs: Preferences
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  update: (patch: Partial<Preferences>) => void
  /** True when the resolved theme is dark, whatever the mode. */
  isDark: boolean
  reset: () => void
}

export function usePreferences(): PreferencesApi {
  const ctx = React.useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>')
  return ctx
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = React.useState<Preferences>(readPreferences)
  const [systemDark, setSystemDark] = React.useState(systemPrefersDark)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const isDark = prefs.theme === 'dark' || (prefs.theme === 'system' && systemDark)

  React.useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', isDark ? 'dark' : 'light')
    const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    if (meta) meta.setAttribute('content', isDark ? '#0c0e12' : '#ffffff')
  }, [isDark])

  React.useEffect(() => {
    document.documentElement.dataset.density = prefs.density
  }, [prefs.density])

  React.useEffect(() => {
    try {
      const { theme, ...rest } = prefs
      localStorage.setItem(PREFS_KEY, JSON.stringify(rest))
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Private browsing or a full quota: preferences simply do not persist.
    }
  }, [prefs])

  const api = React.useMemo<PreferencesApi>(
    () => ({
      prefs,
      isDark,
      set: (key, value) => setPrefs((p) => ({ ...p, [key]: value })),
      update: (patch) => setPrefs((p) => ({ ...p, ...patch })),
      reset: () => setPrefs({ ...DEFAULT_PREFERENCES, onboarded: true }),
    }),
    [prefs, isDark],
  )

  return <PreferencesContext.Provider value={api}>{children}</PreferencesContext.Provider>
}
