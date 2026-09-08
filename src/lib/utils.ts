import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Collision-resistant id that works without any network or crypto polyfill. */
export function newId(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${rand}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/* --------------------------------- dates --------------------------------- */

/** `YYYY-MM-DD` for a Date in the *local* timezone. */
export function toDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today(): string {
  return toDateOnly(new Date())
}

/** Parses `YYYY-MM-DD` as local midnight (never UTC — avoids off-by-one days). */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseAnyDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const dateOnly = parseDateOnly(value)
  if (dateOnly) return dateOnly
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function dateOnlyPlusDays(days: number, from = new Date()): string {
  return toDateOnly(addDays(from, days))
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Whole calendar days from today: negative = past, 0 = today, positive = future. */
export function daysFromToday(value: string | undefined | null, now = new Date()): number | null {
  const d = parseAnyDate(value)
  if (!d) return null
  const diff = startOfDay(d).getTime() - startOfDay(now).getTime()
  return Math.round(diff / 86_400_000)
}

export function daysSince(value: string | undefined | null, now = new Date()): number | null {
  const n = daysFromToday(value, now)
  return n === null ? null : -n
}

/** Monday-based start of the ISO week. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

/* -------------------------------- formatting ------------------------------ */

const dtf = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, opts)

export function formatDate(value: string | undefined | null, fallback = '—'): string {
  const d = parseAnyDate(value)
  if (!d) return fallback
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return dtf({ month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }).format(d)
}

export function formatLongDate(value: string | undefined | null, fallback = '—'): string {
  const d = parseAnyDate(value)
  if (!d) return fallback
  return dtf({ weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }).format(d)
}

export function formatTime(value: string | undefined | null, fallback = '—'): string {
  const d = parseAnyDate(value)
  if (!d) return fallback
  return dtf({ hour: 'numeric', minute: '2-digit' }).format(d)
}

export function formatDateTime(value: string | undefined | null, fallback = '—'): string {
  const d = parseAnyDate(value)
  if (!d) return fallback
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return dtf({
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

/** "Today", "Tomorrow", "3d overdue", "in 5d", "Mar 14". */
export function formatRelativeDay(value: string | undefined | null, fallback = '—'): string {
  const n = daysFromToday(value)
  if (n === null) return fallback
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n < 0) return `${Math.abs(n)}d overdue`
  if (n <= 7) return `in ${n}d`
  return formatDate(value, fallback)
}

/** Compact "2h ago" / "3d ago" / "Mar 14" for timeline entries. */
export function formatAgo(value: string | undefined | null, fallback = '—'): string {
  const d = parseAnyDate(value)
  if (!d) return fallback
  const secs = Math.round((Date.now() - d.getTime()) / 1000)
  if (secs < 45) return 'just now'
  if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))}m ago`
  if (secs < 86_400) return `${Math.round(secs / 3600)}h ago`
  const days = Math.round(secs / 86_400)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.round(days / 7)}w ago`
  return formatDate(value, fallback)
}

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  INR: '₹',
  SGD: 'S$',
  CHF: 'CHF ',
  JPY: '¥',
}

export const CURRENCIES = Object.keys(CURRENCY_SYMBOL)

export function currencySymbol(code: string | undefined): string {
  return CURRENCY_SYMBOL[code ?? 'USD'] ?? `${code} `
}

/** 145000 -> "$145k"; 1450000 -> "$1.45M". */
export function formatCompact(amount: number | undefined | null, currency = 'USD'): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '—'
  const sym = currencySymbol(currency)
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (abs >= 1_000) return `${sym}${Math.round(amount / 1000)}k`
  return `${sym}${amount}`
}

export function formatMoney(amount: number | undefined | null, currency = 'USD'): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '—'
  return `${currencySymbol(currency)}${amount.toLocaleString()}`
}

export function formatSalaryRange(
  min: number | undefined,
  max: number | undefined,
  currency = 'USD',
): string {
  if (min && max) {
    if (min === max) return formatCompact(min, currency)
    return `${formatCompact(min, currency)}–${formatCompact(max, currency)}`
  }
  if (min) return `${formatCompact(min, currency)}+`
  if (max) return `up to ${formatCompact(max, currency)}`
  return '—'
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

/* --------------------------------- text ---------------------------------- */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

export function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Splits free text into lowercase word tokens, dropping punctuation. */
export function tokenize(s: string): string[] {
  return normalize(s)
    .replace(/[^a-z0-9+#./ -]/g, ' ')
    .split(/[\s/]+/)
    .filter((t) => t.length > 0)
}

export function hostnameOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Accepts "acme.com/jobs" as well as a full URL; returns null when unusable. */
export function normalizeUrl(input: string | undefined): string | undefined {
  const raw = input?.trim()
  if (!raw) return undefined
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const u = new URL(withScheme)
    if (!u.hostname.includes('.')) return undefined
    return u.toString()
  } catch {
    return undefined
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

export function sortBy<T>(items: T[], key: (item: T) => number | string): T[] {
  return [...items].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    if (ka < kb) return -1
    if (ka > kb) return 1
    return 0
  })
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of items) {
    const k = key(item)
    ;(out[k] ??= []).push(item)
  }
  return out
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function average(values: number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2 : (s[mid] ?? 0)
}

/** Splits a comma/newline separated string into a clean list. */
export function parseList(value: string): string[] {
  return uniq(
    value
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

/**
 * Copies text to the clipboard, falling back to a hidden textarea where the
 * async Clipboard API is unavailable or blocked. Returns whether it worked, so
 * the caller can tell the user rather than pretending.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
}

/** Debounce that preserves `this`-less arrow usage and is cancellable. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  const wrapped = (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
  wrapped.cancel = () => {
    if (t) clearTimeout(t)
  }
  return wrapped
}
