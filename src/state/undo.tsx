import * as React from 'react'
import { UndoContext } from './contexts'
import { newId } from '@/lib/utils'

/**
 * A short history of reversible actions.
 *
 * Toasts already carry an Undo button, but a toast is gone in nine seconds and
 * the regret usually arrives later. Every action that offers an undo is
 * recorded here as well, so ⌘Z still works a few minutes on.
 *
 * The stack holds closures over records captured before the change, so undoing
 * restores exactly what was there. It is deliberately not persisted: after a
 * reload those closures would be meaningless, and a restore point is the right
 * tool at that distance.
 */

export interface UndoEntry {
  id: string
  label: string
  description?: string
  at: number
  run: () => void | Promise<void>
  undone: boolean
}

const MAX_ENTRIES = 25

export interface UndoApi {
  entries: UndoEntry[]
  /** Records a reversible action and returns its id. */
  push: (label: string, run: () => void | Promise<void>, description?: string) => string
  /** Reverses one specific action, if it has not been reversed already. */
  undoById: (id: string) => Promise<UndoEntry | null>
  /** Reverses the most recent action that is still standing. */
  undoLast: () => Promise<UndoEntry | null>
  /** The action ⌘Z would reverse next. */
  next: UndoEntry | null
  clear: () => void
}

export function useUndo(): UndoApi {
  const ctx = React.useContext(UndoContext)
  if (!ctx) throw new Error('useUndo must be used inside <UndoProvider>')
  return ctx
}

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<UndoEntry[]>([])
  // Mirrors the state so callbacks can read the current stack without being
  // rebuilt on every push.
  const ref = React.useRef<UndoEntry[]>([])
  ref.current = entries

  const push = React.useCallback(
    (label: string, run: () => void | Promise<void>, description?: string) => {
      const entry: UndoEntry = { id: newId('un_'), label, description, at: Date.now(), run, undone: false }
      setEntries((current) => [entry, ...current].slice(0, MAX_ENTRIES))
      return entry.id
    },
    [],
  )

  const runEntry = React.useCallback(async (entry: UndoEntry): Promise<UndoEntry | null> => {
    if (entry.undone) return null
    // Marked before running so a double press cannot fire it twice.
    setEntries((current) => current.map((e) => (e.id === entry.id ? { ...e, undone: true } : e)))
    try {
      await entry.run()
      return entry
    } catch (error) {
      console.error('Could not undo that action', error)
      setEntries((current) => current.map((e) => (e.id === entry.id ? { ...e, undone: false } : e)))
      return null
    }
  }, [])

  const undoById = React.useCallback(
    async (id: string) => {
      const entry = ref.current.find((e) => e.id === id)
      return entry ? runEntry(entry) : null
    },
    [runEntry],
  )

  const undoLast = React.useCallback(async () => {
    const entry = ref.current.find((e) => !e.undone)
    return entry ? runEntry(entry) : null
  }, [runEntry])

  const value = React.useMemo<UndoApi>(
    () => ({
      entries,
      push,
      undoById,
      undoLast,
      next: entries.find((e) => !e.undone) ?? null,
      clear: () => setEntries([]),
    }),
    [entries, push, undoById, undoLast],
  )

  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>
}
