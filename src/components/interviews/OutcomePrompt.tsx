import * as React from 'react'
import { Ban, Check, Clock, X } from 'lucide-react'
import { Modal } from '@/components/ui/overlay'
import { Button } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { recordOutcome } from '@/lib/repo'
import { OUTCOME_SNOOZE_DAYS } from '@/lib/rehearsal'
import { INTERVIEW_TYPE_META, type InterviewOutcome } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

/**
 * One question, three answers.
 *
 * An interview with no result is a hole in the record — the round analysis
 * cannot see it and the pipeline still counts it as live — but the only place
 * to set one used to be an edit dialog nobody opens. This asks directly, and
 * treats "still waiting" as a real answer rather than a way to dismiss the
 * question, because most of the time it is the truth.
 */

type Answer = InterviewOutcome | 'waiting'

const ANSWERS: Array<{
  value: Answer
  label: string
  hint: string
  icon: React.ReactNode
  tone: 'positive' | 'critical' | 'neutral'
}> = [
  {
    value: 'advanced',
    label: 'Moved on',
    hint: 'They took it further.',
    icon: <Check />,
    tone: 'positive',
  },
  {
    value: 'rejected',
    label: 'Rejected',
    hint: 'This one ended here.',
    icon: <Ban />,
    tone: 'critical',
  },
  {
    value: 'waiting',
    label: 'Still waiting',
    hint: `Asked again in ${OUTCOME_SNOOZE_DAYS} days.`,
    icon: <Clock />,
    tone: 'neutral',
  },
]

export function OutcomePrompt() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const [saving, setSaving] = React.useState<Answer | null>(null)

  const interview = workspace.interviews.find((iv) => iv.id === ui.outcomePrompt.interviewId)
  const opportunity = workspace.opportunities.find((o) => o.id === interview?.opportunityId)

  const answer = async (value: Answer) => {
    if (!interview) return
    setSaving(value)
    try {
      const { undo } = await recordOutcome(interview.id, value)
      ui.closeOutcomePrompt()
      toast.undoable(
        value === 'waiting' ? 'Left as waiting' : value === 'advanced' ? 'Recorded as moved on' : 'Recorded as rejected',
        undo,
        opportunity ? `${opportunity.company} · ${interview.type.replace(/_/g, ' ')}` : undefined,
      )
    } catch (error) {
      toast.error('Could not save that', error instanceof Error ? error.message : undefined)
    } finally {
      setSaving(null)
    }
  }

  if (!interview) return null

  return (
    <Modal
      open={ui.outcomePrompt.open}
      onOpenChange={(open) => !open && ui.closeOutcomePrompt()}
      title="Did you hear back?"
      description={
        <>
          {INTERVIEW_TYPE_META[interview.type].label}
          {opportunity ? ` · ${opportunity.company}` : ''} · {formatDate(interview.scheduledAt)}
        </>
      }
      footer={
        <Button variant="ghost" icon={<X />} onClick={() => ui.closeOutcomePrompt()}>
          Not now
        </Button>
      }
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {ANSWERS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={saving !== null}
            onClick={() => void answer(option.value)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              'disabled:opacity-60',
              option.tone === 'positive'
                ? 'border-line bg-panel hover:border-positive/50 hover:bg-positive-soft/40'
                : option.tone === 'critical'
                  ? 'border-line bg-panel hover:border-critical/50 hover:bg-critical-soft/40'
                  : 'border-line bg-panel hover:border-line-strong hover:bg-subtle',
              saving === option.value && 'border-accent bg-accent-soft',
            )}
          >
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5',
                option.tone === 'positive'
                  ? 'bg-positive-soft text-positive'
                  : option.tone === 'critical'
                    ? 'bg-critical-soft text-critical'
                    : 'bg-subtle text-muted',
              )}
              aria-hidden
            >
              {option.icon}
            </span>
            <span className="text-base font-medium text-fg">{option.label}</span>
            <span className="text-xs leading-relaxed text-muted">{option.hint}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        This is what fills in which rounds you get past and which end it. A rejection recorded is
        worth as much as an offer — more, usually.
      </p>
    </Modal>
  )
}
