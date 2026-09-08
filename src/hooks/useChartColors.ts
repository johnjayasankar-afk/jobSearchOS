import * as React from 'react'
import { usePreferences } from '@/state/preferences'

/**
 * Recharts writes colours as SVG presentation attributes, which do not resolve
 * `var()`. This reads the design tokens off the document and returns concrete
 * colour strings, recomputed whenever the theme changes.
 */
export interface ChartColors {
  accent: string
  accentSoft: string
  positive: string
  caution: string
  critical: string
  info: string
  line: string
  muted: string
  faint: string
  panel: string
  fg: string
  series: string[]
}

function read(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value ? `hsl(${value})` : fallback
}

export function useChartColors(): ChartColors {
  const { isDark } = usePreferences()

  return React.useMemo(() => {
    const accent = read('--accent', '#2f6fe4')
    const positive = read('--positive', '#12805c')
    const caution = read('--caution', '#a45c07')
    const critical = read('--critical', '#c02b3f')
    const info = read('--info', '#1673a8')
    return {
      accent,
      accentSoft: read('--accent-soft', '#eef2ff'),
      positive,
      caution,
      critical,
      info,
      line: read('--line', '#e5e7eb'),
      muted: read('--muted', '#6b7280'),
      faint: read('--faint', '#9ca3af'),
      panel: read('--panel', '#ffffff'),
      fg: read('--fg', '#111827'),
      series: [accent, positive, caution, info, critical],
    }
    // isDark is the trigger: the tokens themselves change with the theme.
  }, [isDark])
}
