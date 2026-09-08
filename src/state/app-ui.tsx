import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppUiContext } from './contexts'
import type { ActionCommand } from '@/lib/agenda'
import type { Contact, Interview, InterviewType, Opportunity, Story, StoryTag } from '@/lib/types'
import type { NewOpportunity } from '@/lib/repo'

/**
 * Cross-page UI coordination. Every surface that needs to open a record — the
 * agenda on Today, a board card, a search result, the command palette — goes
 * through here, so a record always opens the same way from anywhere.
 *
 * The open opportunity lives in the URL (`?opportunity=<id>`) so it survives a
 * refresh and works with the browser's back button.
 */

export interface OpportunityEditorState {
  open: boolean
  prefill?: Partial<NewOpportunity>
  /** Set when editing an existing record rather than creating one. */
  existing?: Opportunity
}

export interface ContactEditorState {
  open: boolean
  contact?: Contact
  prefill?: Partial<Contact>
}

export interface InterviewEditorState {
  open: boolean
  interview?: Interview
  opportunityId?: string
}

export interface StoryEditorState {
  open: boolean
  story?: Story
  /** Seeds a *new* story, e.g. with the theme you found a gap in. */
  prefill?: { tags?: string[] }
}

export interface NextActionPromptState {
  open: boolean
  opportunity?: Opportunity
}

export interface LogTouchState {
  open: boolean
  contactId?: string
}

export interface CompareState {
  open: boolean
  ids: string[]
}

/** What the follow-up composer is drafting a message about. */
export type ComposerTarget =
  | { kind: 'contact'; contactId: string; opportunityId?: string }
  | { kind: 'interview'; interviewId: string }
  | { kind: 'opportunity'; opportunityId: string }

export interface ComposerState {
  open: boolean
  target?: ComposerTarget
  /** Opens straight onto a specific template, used from Settings. */
  templateId?: string
}

export interface PrepSheetState {
  open: boolean
  interviewId?: string
}

export interface ReviewState {
  open: boolean
}

export interface DebriefState {
  open: boolean
  interviewId?: string
}

export interface DecisionState {
  open: boolean
  opportunityId?: string
}

export interface OutcomePromptState {
  open: boolean
  interviewId?: string
}

export interface RehearsalState {
  open: boolean
  /** Narrow the drill to the formats of a specific interview. */
  interviewId?: string
  /** Practise one theme, from the readiness map. */
  theme?: StoryTag
  /** Practise the questions asked in one kind of round. */
  format?: InterviewType
  /** Practise one story, from its card. */
  storyId?: string
}

export interface AppUiApi {
  openedOpportunityId: string | null
  openedTab: string | null
  openOpportunity: (id: string, tab?: string) => void
  closeOpportunity: () => void

  opportunityEditor: OpportunityEditorState
  openAddOpportunity: (prefill?: Partial<NewOpportunity>) => void
  openEditOpportunity: (opportunity: Opportunity) => void
  closeAddOpportunity: () => void

  contactEditor: ContactEditorState
  openContactEditor: (state?: Omit<ContactEditorState, 'open'>) => void
  closeContactEditor: () => void

  interviewEditor: InterviewEditorState
  openInterviewEditor: (state?: Omit<InterviewEditorState, 'open'>) => void
  closeInterviewEditor: () => void

  storyEditor: StoryEditorState
  openStoryEditor: (story?: Story, prefill?: StoryEditorState['prefill']) => void
  closeStoryEditor: () => void

  nextActionPrompt: NextActionPromptState
  openNextActionPrompt: (opportunity: Opportunity) => void
  closeNextActionPrompt: () => void

  logTouch: LogTouchState
  openLogTouch: (contactId: string) => void
  closeLogTouch: () => void

  compare: CompareState
  openCompare: (ids: string[]) => void
  closeCompare: () => void

  composer: ComposerState
  openComposer: (target?: ComposerTarget, templateId?: string) => void
  closeComposer: () => void

  prepSheet: PrepSheetState
  openPrepSheet: (interviewId: string) => void
  closePrepSheet: () => void

  review: ReviewState
  openReview: () => void
  closeReview: () => void

  rehearsal: RehearsalState
  openRehearsal: (options?: Omit<RehearsalState, 'open'>) => void
  closeRehearsal: () => void

  debrief: DebriefState
  openDebrief: (interviewId: string) => void
  closeDebrief: () => void

  outcomePrompt: OutcomePromptState
  openOutcomePrompt: (interviewId: string) => void
  closeOutcomePrompt: () => void

  decision: DecisionState
  openDecision: (opportunityId: string) => void
  closeDecision: () => void

  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void

  navigateTo: (path: string) => void
}

export function useAppUi(): AppUiApi {
  const ctx = React.useContext(AppUiContext)
  if (!ctx) throw new Error('useAppUi must be used inside <AppUiProvider>')
  return ctx
}

export function AppUiProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [opportunityEditor, setOpportunityEditor] = React.useState<OpportunityEditorState>({ open: false })
  const [contactEditor, setContactEditor] = React.useState<ContactEditorState>({ open: false })
  const [interviewEditor, setInterviewEditor] = React.useState<InterviewEditorState>({ open: false })
  const [storyEditor, setStoryEditor] = React.useState<StoryEditorState>({ open: false })
  const [nextActionPrompt, setNextActionPrompt] = React.useState<NextActionPromptState>({ open: false })
  const [logTouch, setLogTouch] = React.useState<LogTouchState>({ open: false })
  const [compare, setCompare] = React.useState<CompareState>({ open: false, ids: [] })
  const [composer, setComposer] = React.useState<ComposerState>({ open: false })
  const [prepSheet, setPrepSheet] = React.useState<PrepSheetState>({ open: false })
  const [review, setReview] = React.useState<ReviewState>({ open: false })
  const [rehearsal, setRehearsal] = React.useState<RehearsalState>({ open: false })
  const [debrief, setDebrief] = React.useState<DebriefState>({ open: false })
  const [outcomePrompt, setOutcomePrompt] = React.useState<OutcomePromptState>({ open: false })
  const [decision, setDecision] = React.useState<DecisionState>({ open: false })
  const [paletteOpen, setPaletteOpen] = React.useState(false)

  const openedOpportunityId = searchParams.get('opportunity')
  const openedTab = searchParams.get('tab')

  const openOpportunity = React.useCallback(
    (id: string, tab?: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('opportunity', id)
          if (tab) next.set('tab', tab)
          else next.delete('tab')
          return next
        },
        { replace: false },
      )
    },
    [setSearchParams],
  )

  const closeOpportunity = React.useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('opportunity')
        next.delete('tab')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const api = React.useMemo<AppUiApi>(
    () => ({
      openedOpportunityId,
      openedTab,
      openOpportunity,
      closeOpportunity,

      opportunityEditor,
      openAddOpportunity: (prefill) => setOpportunityEditor({ open: true, prefill }),
      openEditOpportunity: (existing) => setOpportunityEditor({ open: true, existing }),
      closeAddOpportunity: () => setOpportunityEditor({ open: false }),

      contactEditor,
      openContactEditor: (state) => setContactEditor({ open: true, ...state }),
      closeContactEditor: () => setContactEditor({ open: false }),

      interviewEditor,
      openInterviewEditor: (state) => setInterviewEditor({ open: true, ...state }),
      closeInterviewEditor: () => setInterviewEditor({ open: false }),

      storyEditor,
      openStoryEditor: (story, prefill) => setStoryEditor({ open: true, story, prefill }),
      closeStoryEditor: () => setStoryEditor({ open: false }),

      nextActionPrompt,
      openNextActionPrompt: (opportunity) => setNextActionPrompt({ open: true, opportunity }),
      closeNextActionPrompt: () => setNextActionPrompt({ open: false }),

      logTouch,
      openLogTouch: (contactId) => setLogTouch({ open: true, contactId }),
      closeLogTouch: () => setLogTouch({ open: false }),

      compare,
      openCompare: (ids) => setCompare({ open: true, ids }),
      closeCompare: () => setCompare((c) => ({ ...c, open: false })),

      composer,
      openComposer: (target, templateId) => setComposer({ open: true, target, templateId }),
      closeComposer: () => setComposer((c) => ({ ...c, open: false })),

      prepSheet,
      openPrepSheet: (interviewId) => setPrepSheet({ open: true, interviewId }),
      closePrepSheet: () => setPrepSheet((p) => ({ ...p, open: false })),

      review,
      openReview: () => setReview({ open: true }),
      closeReview: () => setReview({ open: false }),

      rehearsal,
      openRehearsal: (options) => setRehearsal({ ...options, open: true }),
      closeRehearsal: () => setRehearsal((r) => ({ ...r, open: false })),

      debrief,
      openDebrief: (interviewId) => setDebrief({ open: true, interviewId }),
      closeDebrief: () => setDebrief((d) => ({ ...d, open: false })),

      outcomePrompt,
      openOutcomePrompt: (interviewId) => setOutcomePrompt({ open: true, interviewId }),
      closeOutcomePrompt: () => setOutcomePrompt((p) => ({ ...p, open: false })),

      decision,
      openDecision: (opportunityId) => setDecision({ open: true, opportunityId }),
      closeDecision: () => setDecision((d) => ({ ...d, open: false })),

      paletteOpen,
      setPaletteOpen,
      navigateTo: (path) => navigate(path),
    }),
    [
      openedOpportunityId,
      openedTab,
      openOpportunity,
      closeOpportunity,
      opportunityEditor,
      contactEditor,
      interviewEditor,
      storyEditor,
      nextActionPrompt,
      logTouch,
      compare,
      composer,
      prepSheet,
      review,
      rehearsal,
      debrief,
      outcomePrompt,
      decision,
      paletteOpen,
      navigate,
    ],
  )

  return <AppUiContext.Provider value={api}>{children}</AppUiContext.Provider>
}

/**
 * Resolves an agenda command into UI intent. Data mutations that need a toast
 * are handled by the caller so the undo affordance stays close to the action.
 */
export interface ActionLookup {
  opportunities: Map<string, Opportunity>
  contacts: Map<string, Contact>
  interviews: Map<string, Interview>
}

export function useActionRunner() {
  const ui = useAppUi()
  return React.useCallback(
    (command: ActionCommand, lookup: ActionLookup) => {
      switch (command.kind) {
        case 'open_opportunity':
          ui.openOpportunity(command.opportunityId)
          return
        case 'open_interview': {
          const interview = lookup.interviews.get(command.interviewId)
          if (interview) ui.openInterviewEditor({ interview })
          return
        }
        case 'rehearse_interview':
          ui.openRehearsal({ interviewId: command.interviewId })
          return
        case 'debrief_interview':
          ui.openDebrief(command.interviewId)
          return
        case 'record_outcome':
          ui.openOutcomePrompt(command.interviewId)
          return
        case 'decide_offer':
          ui.openDecision(command.opportunityId)
          return
        case 'open_contact': {
          const contact = lookup.contacts.get(command.contactId)
          if (contact) ui.openContactEditor({ contact })
          return
        }
        case 'log_touch':
          ui.openLogTouch(command.contactId)
          return
        case 'draft_contact':
          ui.openComposer({
            kind: 'contact',
            contactId: command.contactId,
            opportunityId: command.opportunityId,
          })
          return
        case 'draft_interview':
          ui.openComposer({ kind: 'interview', interviewId: command.interviewId })
          return
        case 'set_next_action': {
          const opportunity = lookup.opportunities.get(command.opportunityId)
          if (opportunity) ui.openNextActionPrompt(opportunity)
          return
        }
        default:
          return
      }
    },
    [ui],
  )
}
