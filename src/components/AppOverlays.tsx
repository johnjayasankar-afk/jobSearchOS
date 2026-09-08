import * as React from 'react'
import { useAppUi } from '@/state/app-ui'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useMountOnce, usePrefetchOnIdle } from '@/hooks/useMountOnce'
import { Modal } from '@/components/ui/overlay'
import { Kbd } from '@/components/ui/primitives'
import { isMac } from '@/lib/utils'

/**
 * Every globally mounted dialog and panel.
 *
 * Each one is a separate chunk that is only fetched the first time it is
 * needed, and prefetched on idle so that first open still feels instant. Once
 * mounted they stay mounted, which keeps their exit animations intact.
 */

const loadCommandPalette = () => import('@/components/CommandPalette')
const loadOpportunityPanel = () => import('@/components/opportunity/OpportunityPanel')
const loadOpportunityDialog = () => import('@/components/opportunity/OpportunityDialog')
const loadContactDialogs = () => import('@/components/contacts/ContactDialogs')
const loadInterviewDialog = () => import('@/components/interviews/InterviewDialog')
const loadStoryDialog = () => import('@/components/stories/StoryDialog')
const loadNextActionPrompt = () => import('@/components/NextActionPrompt')
const loadCompareDialog = () => import('@/components/opportunity/CompareDialog')
const loadComposer = () => import('@/components/followups/ComposerDialog')
const loadPrepSheet = () => import('@/components/interviews/PrepSheet')
const loadWeeklyReview = () => import('@/components/WeeklyReview')
const loadRehearsal = () => import('@/components/stories/Rehearsal')
const loadDebrief = () => import('@/components/interviews/DebriefSheet')
const loadOutcome = () => import('@/components/interviews/OutcomePrompt')
const loadDecision = () => import('@/components/opportunity/DecisionSheet')

const CommandPalette = React.lazy(async () => ({ default: (await loadCommandPalette()).CommandPalette }))
const OpportunityPanel = React.lazy(async () => ({ default: (await loadOpportunityPanel()).OpportunityPanel }))
const OpportunityDialog = React.lazy(async () => ({ default: (await loadOpportunityDialog()).OpportunityDialog }))
const ContactDialog = React.lazy(async () => ({ default: (await loadContactDialogs()).ContactDialog }))
const LogTouchDialog = React.lazy(async () => ({ default: (await loadContactDialogs()).LogTouchDialog }))
const InterviewDialog = React.lazy(async () => ({ default: (await loadInterviewDialog()).InterviewDialog }))
const StoryDialog = React.lazy(async () => ({ default: (await loadStoryDialog()).StoryDialog }))
const NextActionPrompt = React.lazy(async () => ({ default: (await loadNextActionPrompt()).NextActionPrompt }))
const CompareDialog = React.lazy(async () => ({ default: (await loadCompareDialog()).CompareDialog }))
const ComposerDialog = React.lazy(async () => ({ default: (await loadComposer()).ComposerDialog }))
const PrepSheet = React.lazy(async () => ({ default: (await loadPrepSheet()).PrepSheet }))
const WeeklyReview = React.lazy(async () => ({ default: (await loadWeeklyReview()).WeeklyReview }))
const Rehearsal = React.lazy(async () => ({ default: (await loadRehearsal()).Rehearsal }))
const DebriefSheet = React.lazy(async () => ({ default: (await loadDebrief()).DebriefSheet }))
const OutcomePrompt = React.lazy(async () => ({ default: (await loadOutcome()).OutcomePrompt }))
const DecisionSheet = React.lazy(async () => ({ default: (await loadDecision()).DecisionSheet }))

const PREFETCH = [
  loadCommandPalette,
  loadOpportunityPanel,
  loadOpportunityDialog,
  loadContactDialogs,
  loadInterviewDialog,
  loadStoryDialog,
  loadNextActionPrompt,
]

export function AppOverlays() {
  const ui = useAppUi()
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

  usePrefetchOnIdle(PREFETCH)
  useHotkeys([{ key: '?', shift: true, handler: () => setShortcutsOpen((s) => !s) }])

  const palette = useMountOnce(ui.paletteOpen)
  const panel = useMountOnce(Boolean(ui.openedOpportunityId))
  const opportunityEditor = useMountOnce(ui.opportunityEditor.open)
  const contactEditor = useMountOnce(ui.contactEditor.open)
  const logTouch = useMountOnce(ui.logTouch.open)
  const interviewEditor = useMountOnce(ui.interviewEditor.open)
  const storyEditor = useMountOnce(ui.storyEditor.open)
  const nextAction = useMountOnce(ui.nextActionPrompt.open)
  const compare = useMountOnce(ui.compare.open)
  const composer = useMountOnce(ui.composer.open)
  const prepSheet = useMountOnce(ui.prepSheet.open)
  const review = useMountOnce(ui.review.open)
  const rehearsal = useMountOnce(ui.rehearsal.open)
  const debrief = useMountOnce(ui.debrief.open)
  const outcomePrompt = useMountOnce(ui.outcomePrompt.open)
  const decision = useMountOnce(ui.decision.open)

  return (
    <React.Suspense fallback={null}>
      {palette && <CommandPalette />}
      {panel && <OpportunityPanel />}
      {opportunityEditor && (
        <OpportunityDialog
          open={ui.opportunityEditor.open}
          onOpenChange={(open) => !open && ui.closeAddOpportunity()}
          prefill={ui.opportunityEditor.prefill}
          existing={ui.opportunityEditor.existing}
        />
      )}
      {contactEditor && <ContactDialog />}
      {logTouch && <LogTouchDialog />}
      {interviewEditor && <InterviewDialog />}
      {storyEditor && <StoryDialog />}
      {nextAction && <NextActionPrompt />}
      {compare && <CompareDialog />}
      {composer && <ComposerDialog />}
      {prepSheet && <PrepSheet />}
      {review && <WeeklyReview />}
      {rehearsal && <Rehearsal />}
      {debrief && <DebriefSheet />}
      {outcomePrompt && <OutcomePrompt />}
      {decision && <DecisionSheet />}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </React.Suspense>
  )
}

/* ----------------------------- Shortcut sheet ----------------------------- */

const SHORTCUT_GROUPS: Array<{ title: string; rows: Array<{ keys: string[]; label: string }> }> = [
  {
    title: 'Anywhere',
    rows: [
      { keys: ['⌘', 'K'], label: 'Search and commands' },
      { keys: ['N'], label: 'Add an opportunity' },
      { keys: ['/'], label: 'Focus the search field' },
      { keys: ['⌘', 'Z'], label: 'Undo the last change' },
      { keys: ['?'], label: 'This list' },
      { keys: ['Esc'], label: 'Close a panel or clear a selection' },
    ],
  },
  {
    title: 'Go to',
    rows: [
      { keys: ['G', 'then', 'T'], label: 'Today' },
      { keys: ['G', 'then', 'O'], label: 'Opportunities' },
      { keys: ['G', 'then', 'P'], label: 'Pipeline' },
      { keys: ['G', 'then', 'C'], label: 'Contacts' },
      { keys: ['G', 'then', 'I'], label: 'Interviews' },
      { keys: ['G', 'then', 'S'], label: 'Story Bank' },
      { keys: ['G', 'then', 'A'], label: 'Analytics' },
    ],
  },
  {
    title: 'In rehearsal',
    rows: [
      { keys: ['Space'], label: 'Start or stop the clock' },
      { keys: ['P'], label: 'Peek at your notes' },
      { keys: ['S'], label: 'Skip this question' },
    ],
  },
  {
    title: 'In the opportunities table',
    rows: [
      { keys: ['↑', '↓'], label: 'Move between rows' },
      { keys: ['↵'], label: 'Open the focused row' },
      { keys: ['X'], label: 'Select the focused row' },
      { keys: ['⌘', 'A'], label: 'Select everything in view' },
      { keys: ['S'], label: 'Change stage' },
      { keys: ['P'], label: 'Change priority' },
      { keys: ['E'], label: 'Archive' },
      { keys: ['D'], label: 'Set a next action' },
    ],
  },
]

function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const mod = isMac() ? '⌘' : 'Ctrl'
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts" size="lg">
      <div className="grid gap-6 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} className={group.title === 'Go to' ? '' : 'sm:col-span-1'}>
            <h3 className="section-title mb-2">{group.title}</h3>
            <ul className="space-y-1.5">
              {group.rows.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-4">
                  <span className="min-w-0 text-base text-muted">{row.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {row.keys.map((key, i) =>
                      key === 'then' ? (
                        <span key={i} className="text-2xs text-faint">
                          then
                        </span>
                      ) : (
                        <Kbd key={i}>{key === '⌘' ? mod : key}</Kbd>
                      ),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
