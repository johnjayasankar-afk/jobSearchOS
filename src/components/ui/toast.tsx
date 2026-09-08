import * as React from 'react'
import * as RToast from '@radix-ui/react-toast'
import { AlertTriangle, CheckCircle2, Info, X, Undo2 } from 'lucide-react'
import { useUndo } from '@/state/undo'
import { cn, newId } from '@/lib/utils'

export type ToastTone = 'default' | 'success' | 'warning' | 'error'

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
  durationMs?: number
  /** Renders an Undo affordance; the toast closes once it resolves. */
  onUndo?: () => void | Promise<void>
  action?: { label: string; onClick: () => void }
}

interface ToastRecord extends ToastOptions {
  id: string
}

interface ToastApi {
  toast: (options: ToastOptions) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  /** Convenience for "X done · Undo". */
  undoable: (title: string, undo: () => void | Promise<void>, description?: string) => void
}

const ToastContext = React.createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const TONE_ICON: Record<ToastTone, React.ReactNode> = {
  default: <Info className="h-4 w-4 text-info" />,
  success: <CheckCircle2 className="h-4 w-4 text-positive" />,
  warning: <AlertTriangle className="h-4 w-4 text-caution" />,
  error: <AlertTriangle className="h-4 w-4 text-critical" />,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastRecord[]>([])
  const undo = useUndo()

  const dismiss = React.useCallback((id: string) => {
    setItems((current) => current.filter((t) => t.id !== id))
  }, [])

  const api = React.useMemo<ToastApi>(() => {
    const toast = (options: ToastOptions) => {
      const record: ToastRecord = { id: newId('ts_'), tone: 'default', ...options }
      // Keep at most three visible; older ones drop off the top.
      setItems((current) => [...current.slice(-2), record])
    }
    return {
      toast,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error', durationMs: 8000 }),
      // Every reversible action also joins the undo history, so the same
      // action can be taken back with a keystroke long after the toast is gone.
      undoable: (title, onUndo, description) => {
        const entryId = undo.push(title, onUndo, description)
        toast({
          title,
          description,
          durationMs: 9000,
          onUndo: async () => {
            await undo.undoById(entryId)
          },
        })
      },
    }
  }, [undo])

  return (
    <ToastContext.Provider value={api}>
      <RToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => (
          <RToast.Root
            key={item.id}
            duration={item.durationMs ?? (item.onUndo ? 9000 : 5000)}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id)
            }}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-panel p-3 shadow-lg',
              'data-[state=open]:animate-slide-up data-[state=closed]:animate-fade-out',
              'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform',
              'data-[swipe=end]:animate-fade-out',
            )}
          >
            <span className="mt-px shrink-0">{TONE_ICON[item.tone ?? 'default']}</span>
            <div className="min-w-0 flex-1">
              <RToast.Title className="text-base font-medium leading-snug text-fg">{item.title}</RToast.Title>
              {item.description && (
                <RToast.Description className="mt-0.5 text-sm leading-relaxed text-muted">
                  {item.description}
                </RToast.Description>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {item.onUndo && (
                <RToast.Action asChild altText="Undo the last action">
                  <button
                    type="button"
                    onClick={async () => {
                      await item.onUndo?.()
                      dismiss(item.id)
                    }}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-panel px-2 text-xs font-medium text-fg transition-colors hover:bg-subtle"
                  >
                    <Undo2 className="h-3 w-3" />
                    Undo
                  </button>
                </RToast.Action>
              )}
              {item.action && (
                <RToast.Action asChild altText={item.action.label}>
                  <button
                    type="button"
                    onClick={() => {
                      item.action?.onClick()
                      dismiss(item.id)
                    }}
                    className="inline-flex h-7 items-center rounded-md border border-line bg-panel px-2 text-xs font-medium text-fg transition-colors hover:bg-subtle"
                  >
                    {item.action.label}
                  </button>
                </RToast.Action>
              )}
              <RToast.Close
                aria-label="Dismiss"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-subtle hover:text-fg"
              >
                <X className="h-3.5 w-3.5" />
              </RToast.Close>
            </div>
          </RToast.Root>
        ))}
        <RToast.Viewport className="pointer-events-none fixed bottom-0 right-0 z-[70] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] outline-none" />
      </RToast.Provider>
    </ToastContext.Provider>
  )
}
