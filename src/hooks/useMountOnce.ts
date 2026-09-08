import * as React from 'react'

/**
 * True from the first time `open` becomes true, and true forever after.
 *
 * Overlays are mounted lazily so their code is not in the initial bundle, but
 * once mounted they stay mounted: unmounting on close would cut off the exit
 * animation and throw away the loaded chunk.
 */
export function useMountOnce(open: boolean): boolean {
  const [mounted, setMounted] = React.useState(open)
  React.useEffect(() => {
    if (open) setMounted(true)
  }, [open])
  return mounted || open
}

/**
 * Runs a dynamic import once the browser is idle, so the first time a user
 * opens a dialog its chunk is already in memory.
 */
export function usePrefetchOnIdle(loaders: Array<() => Promise<unknown>>): void {
  React.useEffect(() => {
    let cancelled = false
    const run = () => {
      if (cancelled) return
      for (const load of loaders) void load().catch(() => undefined)
    }
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback
    const handle = idle ? idle(run, { timeout: 4000 }) : window.setTimeout(run, 1800)
    return () => {
      cancelled = true
      const cancelIdle = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback
      if (idle && cancelIdle) cancelIdle(handle as number)
      else window.clearTimeout(handle as number)
    }
    // The loader list is a module-level constant; re-running would defeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
