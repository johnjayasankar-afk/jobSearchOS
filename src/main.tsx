import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdatePrompt } from './components/UpdatePrompt'
import { TooltipProvider } from './components/ui/overlay'
import { ToastProvider } from './components/ui/toast'
import { PreferencesProvider } from './state/preferences'
import { WorkspaceProvider } from './state/workspace'
import { AppUiProvider } from './state/app-ui'
import { UndoProvider } from './state/undo'
import './index.css'

/**
 * Hash routing keeps the app deployable to any static host — including a plain
 * file server or a subdirectory — without server-side rewrite rules.
 */
const container = document.getElementById('root')
if (!container) throw new Error('Root element is missing from index.html')

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PreferencesProvider>
        <TooltipProvider>
          <UndoProvider>
            <ToastProvider>
              <WorkspaceProvider>
                <HashRouter>
                  <AppUiProvider>
                    <App />
                  </AppUiProvider>
                </HashRouter>
                <UpdatePrompt />
              </WorkspaceProvider>
            </ToastProvider>
          </UndoProvider>
        </TooltipProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
