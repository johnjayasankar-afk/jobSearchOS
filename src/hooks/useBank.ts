import * as React from 'react'
import { useWorkspace } from '@/state/workspace'
import { resolveBank, type InterviewQuestion } from '@/lib/questions'

/**
 * The question bank this workspace uses.
 *
 * Resolved here rather than in the workspace provider on purpose: the provider
 * loads on every cold start, and importing the bank there would put all 35
 * questions on the critical path. Every consumer of this hook is behind a lazy
 * route or overlay.
 */
export function useBank(): InterviewQuestion[] {
  const { questions, settings } = useWorkspace()
  const hidden = settings.hiddenQuestionIds
  return React.useMemo(() => resolveBank(questions, hidden ?? []), [questions, hidden])
}
