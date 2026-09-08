import * as React from 'react'

export interface Hotkey {
  /** Lowercase key, e.g. 'k', '/', 'escape'. */
  key: string
  meta?: boolean
  shift?: boolean
  alt?: boolean
  /** Sequence prefix, e.g. 'g' for "g then o". */
  sequence?: string
  handler: (event: KeyboardEvent) => void
  /** Allow the shortcut to fire while a field has focus. */
  allowInInput?: boolean
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'textbox'
  )
}

/**
 * Global keyboard shortcuts, including two-key sequences such as "g o".
 * Shortcuts never fire while the user is typing unless explicitly allowed.
 */
export function useHotkeys(hotkeys: Hotkey[], enabled = true): void {
  const ref = React.useRef(hotkeys)
  ref.current = hotkeys

  React.useEffect(() => {
    if (!enabled) return
    let pending: string | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const clearPending = () => {
      pending = null
      if (timer) clearTimeout(timer)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const typing = isTypingTarget(event.target)
      const meta = event.metaKey || event.ctrlKey

      for (const hotkey of ref.current) {
        if (hotkey.key !== key) continue
        if (Boolean(hotkey.meta) !== meta) continue
        if (Boolean(hotkey.shift) !== event.shiftKey) continue
        if (Boolean(hotkey.alt) !== event.altKey) continue
        if (typing && !hotkey.allowInInput) continue
        if (hotkey.sequence) {
          if (pending !== hotkey.sequence) continue
          clearPending()
        }
        event.preventDefault()
        hotkey.handler(event)
        return
      }

      // Start a sequence when the pressed key is a known prefix.
      if (!typing && !meta && !event.altKey) {
        const prefixes = new Set(ref.current.map((h) => h.sequence).filter(Boolean))
        if (prefixes.has(key)) {
          pending = key
          if (timer) clearTimeout(timer)
          timer = setTimeout(clearPending, 1200)
          return
        }
      }
      clearPending()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (timer) clearTimeout(timer)
    }
  }, [enabled])
}

/** Tracks a media query, e.g. `useMediaQuery('(min-width: 1024px)')`. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  )
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Debounced mirror of a value, for search inputs that filter large lists. */
export function useDebounced<T>(value: T, delayMs = 180): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

/** Locks body scroll while a condition holds (used by mobile overlays). */
export function useBodyScrollLock(locked: boolean): void {
  React.useEffect(() => {
    if (!locked) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}
