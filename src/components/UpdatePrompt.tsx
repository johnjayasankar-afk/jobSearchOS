import * as React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, X } from 'lucide-react'
import { Button, IconButton } from './ui/primitives'

/**
 * Service-worker lifecycle. The app is offline-capable, so a new build only
 * takes effect after a reload — this asks rather than reloading underneath a
 * half-written note.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('Service worker registration failed; the app still works online.', error)
    },
  })

  React.useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(() => setOfflineReady(false), 6000)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <div
      role="status"
      className="fixed bottom-3 left-3 z-[65] w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-line bg-panel p-3 shadow-lg animate-slide-up"
    >
      {needRefresh ? (
        <>
          <div className="flex items-start gap-2.5">
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-fg">A new version is ready</p>
              <p className="mt-0.5 text-sm text-muted">
                Reload when you are at a good stopping point. Your data is unaffected.
              </p>
            </div>
            <IconButton label="Dismiss" size="sm" onClick={() => setNeedRefresh(false)}>
              <X />
            </IconButton>
          </div>
          <div className="mt-2.5 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
              Later
            </Button>
            <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
              Reload now
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2.5">
          <Download className="h-4 w-4 shrink-0 text-positive" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-fg">Ready to work offline.</p>
          <IconButton label="Dismiss" size="sm" onClick={() => setOfflineReady(false)}>
            <X />
          </IconButton>
        </div>
      )}
    </div>
  )
}
