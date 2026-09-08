import * as React from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { AppOverlays } from '@/components/AppOverlays'
import { NAV_ITEMS } from '@/components/layout/nav'
import { Onboarding } from '@/components/Onboarding'
import { Button, Spinner } from '@/components/ui/primitives'
import { TodayPage } from '@/pages/Today'
import { OpportunitiesPage } from '@/pages/Opportunities'
import { usePreferences } from '@/state/preferences'
import { useAppUi } from '@/state/app-ui'
import { useUndo } from '@/state/undo'
import { useToast } from '@/components/ui/toast'
import { useWorkspace } from '@/state/workspace'
import { useHotkeys } from '@/hooks/useHotkeys'
import { readCaptureFromLocation } from '@/lib/capture'
import { usePrefetchOnIdle } from '@/hooks/useMountOnce'

/**
 * Today and Opportunities are the screens people land on, so they ship in the
 * main bundle. The rest are split out and prefetched on idle — by the time a
 * section is clicked its chunk is already in memory, and offline it is
 * precached by the service worker either way.
 */
const loadPipeline = () => import('@/pages/Pipeline')
const loadContacts = () => import('@/pages/Contacts')
const loadInterviews = () => import('@/pages/Interviews')
const loadStories = () => import('@/pages/Stories')
const loadAnalytics = () => import('@/pages/Analytics')
const loadSettings = () => import('@/pages/Settings')

const PipelinePage = React.lazy(async () => ({ default: (await loadPipeline()).PipelinePage }))
const ContactsPage = React.lazy(async () => ({ default: (await loadContacts()).ContactsPage }))
const InterviewsPage = React.lazy(async () => ({ default: (await loadInterviews()).InterviewsPage }))
const StoriesPage = React.lazy(async () => ({ default: (await loadStories()).StoriesPage }))
const AnalyticsPage = React.lazy(async () => ({ default: (await loadAnalytics()).AnalyticsPage }))
const SettingsPage = React.lazy(async () => ({ default: (await loadSettings()).SettingsPage }))

const ROUTE_PREFETCH = [loadPipeline, loadContacts, loadInterviews, loadStories, loadSettings, loadAnalytics]

export function App() {
  const { prefs } = usePreferences()
  const workspace = useWorkspace()

  useGlobalHotkeys()
  useCaptureLink()
  usePrefetchOnIdle(ROUTE_PREFETCH)

  if (!workspace.ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="sr-only">Loading your workspace</span>
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (workspace.storageError) {
    return <StorageBlocked message={workspace.storageError} />
  }

  if (!prefs.onboarded && workspace.isEmpty) {
    return (
      <>
        <Onboarding />
        <AppOverlays />
      </>
    )
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[80] focus:rounded-md focus:border focus:border-line focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>
      <AppShell>
        <React.Suspense fallback={<PageLoading label="Loading" />}>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/opportunities" element={<OpportunitiesPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/interviews" element={<InterviewsPage />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </React.Suspense>
      </AppShell>
      <AppOverlays />
    </>
  )
}

/**
 * Opens the Add dialog when the app is reached from a bookmarklet, the system
 * share sheet or a hand-made link, then strips the parameters so a refresh does
 * not reopen it.
 */
function useCaptureLink() {
  const ui = useAppUi()
  const handled = React.useRef(false)

  React.useEffect(() => {
    if (handled.current) return
    const capture = readCaptureFromLocation(window.location.href)
    if (!capture) return
    handled.current = true
    window.history.replaceState(null, '', capture.cleanedHref)
    ui.openAddOpportunity(capture.prefill)
  }, [ui])
}

function useGlobalHotkeys() {
  const ui = useAppUi()
  const navigate = useNavigate()
  const undo = useUndo()
  const toast = useToast()

  useHotkeys([
    { key: 'k', meta: true, allowInInput: true, handler: () => ui.setPaletteOpen(true) },
    { key: 'n', handler: () => ui.openAddOpportunity() },
    {
      key: 'z',
      meta: true,
      handler: () => {
        void undo.undoLast().then((entry) => {
          if (entry) toast.success('Undone', entry.label)
          else toast.toast({ title: 'Nothing left to undo' })
        })
      },
    },
    ...NAV_ITEMS.map((item) => ({
      key: item.sequenceKey,
      sequence: 'g',
      handler: () => navigate(item.to),
    })),
  ])
}

/* --------------------------------- states --------------------------------- */

function PageLoading({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center" role="status">
      <span className="sr-only">{label}</span>
      <Spinner className="h-5 w-5" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-fg">That page does not exist</h1>
      <p className="max-w-sm text-sm text-muted">
        The address you followed is not part of Opportunity OS. Everything lives under the sections in the
        sidebar.
      </p>
      <Button variant="primary" onClick={() => window.location.assign('#/today')}>
        Go to Today
      </Button>
    </div>
  )
}

function StorageBlocked({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="max-w-md rounded-xl border border-critical/30 bg-panel p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-critical" aria-hidden />
          <div>
            <h1 className="text-md font-semibold text-fg">Opportunity OS cannot save your data</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{message}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Try a normal browsing window, or allow this site to store data, then reload.
            </p>
            <Button className="mt-3" variant="secondary" icon={<RefreshCw />} onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
