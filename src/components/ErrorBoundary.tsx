import * as React from 'react'
import { AlertTriangle } from 'lucide-react'

interface State {
  error: Error | null
}

/**
 * Last line of defence. A rendering failure must never leave the user staring at
 * a blank page, and it must never show them a stack trace — the details go to
 * the console for anyone who wants them.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Opportunity OS hit an unexpected error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex h-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-caution" aria-hidden />
            <div className="min-w-0">
              <h1 className="text-md font-semibold text-fg">Something went wrong on this screen</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Your data is safe — it is stored separately from the interface. Reloading usually clears this.
                If it keeps happening, export a backup from Settings → Data before doing anything else.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-xs transition-opacity hover:opacity-90"
                >
                  Reload the app
                </button>
                <button
                  type="button"
                  onClick={() => this.setState({ error: null })}
                  className="inline-flex h-8 items-center rounded-md border border-line bg-panel px-3 text-sm font-medium text-fg shadow-xs transition-colors hover:bg-subtle"
                >
                  Try again
                </button>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-faint">Technical details</summary>
                <pre className="mt-1.5 max-h-32 overflow-auto rounded border border-line bg-subtle p-2 text-2xs leading-relaxed text-muted">
                  {this.state.error.message}
                </pre>
              </details>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
