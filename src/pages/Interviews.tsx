import * as React from 'react'
import {
  CalendarClock,
  CalendarPlus,
  CircleHelp,
  ClipboardList,
  FileText,
  PenLine,
  Send,
  Video,
} from 'lucide-react'
import { PageHeader, SectionHeader } from '@/components/common'
import { debriefIsDue } from '@/lib/rehearsal'
import { Badge, Button, EmptyState, Meter } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { updateInterview } from '@/lib/repo'
import { buildIcs } from '@/lib/calendar'
import { downloadFile, timestampedFilename } from '@/lib/backup'
import {
  INTERVIEW_OUTCOME_META,
  INTERVIEW_TYPE_META,
  type Interview,
  type Opportunity,
} from '@/lib/types'
import { cn, formatDate, formatTime, parseAnyDate, pluralize } from '@/lib/utils'

export function InterviewsPage() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()

  const { needsFollowUp, upcoming, past } = React.useMemo(() => {
    const now = Date.now()
    const sorted = [...workspace.interviews].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    const upcomingList = sorted
      .filter((iv) => (parseAnyDate(iv.scheduledAt)?.getTime() ?? 0) >= now - 3_600_000)
      .filter((iv) => iv.outcome !== 'cancelled')
    const pastList = sorted
      .filter((iv) => (parseAnyDate(iv.scheduledAt)?.getTime() ?? 0) < now - 3_600_000)
      .reverse()
    const needsFollowUpList = pastList.filter((iv) => !iv.followUpSent && iv.outcome !== 'cancelled')
    const needsFollowUpIds = new Set(needsFollowUpList.map((iv) => iv.id))
    return {
      needsFollowUp: needsFollowUpList,
      upcoming: upcomingList,
      // Anything in the follow-up queue above is not repeated in the history.
      past: pastList.filter((iv) => !needsFollowUpIds.has(iv.id)),
    }
  }, [workspace.interviews])

  const hasAny = workspace.interviews.length > 0

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Interviews"
        description={
          upcoming.length > 0
            ? `${upcoming.length} upcoming`
            : hasAny
              ? 'Nothing scheduled'
              : undefined
        }
        actions={
          <>
            {upcoming.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<CalendarClock />}
                onClick={() => {
                  const ics = buildIcs(
                    upcoming.map((iv) => ({
                      interview: iv,
                      opportunity: workspace.byId.get(iv.opportunityId),
                      interviewerNames: iv.contactIds
                        .map((id) => workspace.contactsById.get(id)?.name)
                        .filter((n): n is string => Boolean(n)),
                    })),
                  )
                  downloadFile(timestampedFilename('interviews', 'ics'), ics, 'text/calendar')
                  toast.success(
                    `Exported ${upcoming.length} ${pluralize(upcoming.length, 'interview')}`,
                    'Open the file to add them to your calendar.',
                  )
                }}
              >
                <span className="hidden sm:inline">Add to calendar</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              icon={<CalendarPlus />}
              disabled={workspace.opportunities.length === 0}
              onClick={() => ui.openInterviewEditor({})}
            >
              <span className="hidden sm:inline">Schedule</span>
            </Button>
          </>
        }
      />

      {!hasAny ? (
        <EmptyState
          icon={<CalendarClock />}
          title="No interviews yet"
          description={
            workspace.opportunities.length === 0
              ? 'Add an opportunity first, then schedule interviews against it to get a prep workspace.'
              : 'Schedule one to get a prep checklist, expected questions and story suggestions in one place.'
          }
          action={
            workspace.opportunities.length > 0 ? (
              <Button variant="primary" icon={<CalendarPlus />} onClick={() => ui.openInterviewEditor({})}>
                Schedule interview
              </Button>
            ) : (
              <Button variant="primary" onClick={() => ui.openAddOpportunity()}>
                Add opportunity
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-7 px-4 py-5 sm:px-6">
          {needsFollowUp.length > 0 && (
            <section>
              <SectionHeader title="Follow-up not recorded" count={needsFollowUp.length} />
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-caution/30">
                {needsFollowUp.map((iv) => (
                  <InterviewRow
                    key={iv.id}
                    interview={iv}
                    opportunity={workspace.byId.get(iv.opportunityId)}
                    past
                    showFollowUpAction
                  />
                ))}
              </ul>
            </section>
          )}

          <section>
            <SectionHeader title="Upcoming" count={upcoming.length} />
            {upcoming.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
                No interviews scheduled.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
                {upcoming.map((iv) => (
                  <InterviewRow key={iv.id} interview={iv} opportunity={workspace.byId.get(iv.opportunityId)} />
                ))}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <SectionHeader title="Past" count={past.length} />
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
                {past.slice(0, 30).map((iv) => (
                  <InterviewRow key={iv.id} interview={iv} opportunity={workspace.byId.get(iv.opportunityId)} past />
                ))}
              </ul>
              {past.length > 30 && (
                <p className="mt-2 text-xs text-faint">
                  Showing the 30 most recent of {past.length} past {pluralize(past.length, 'interview')}.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function InterviewRow({
  interview,
  opportunity,
  past,
  showFollowUpAction,
}: {
  interview: Interview
  opportunity: Opportunity | undefined
  past?: boolean
  showFollowUpAction?: boolean
}) {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()
  const date = parseAnyDate(interview.scheduledAt)
  const done = interview.checklist.filter((c) => c.done).length
  const people = interview.contactIds
    .map((id) => workspace.contactsById.get(id)?.name)
    .filter((n): n is string => Boolean(n))

  return (
    <li className="flex items-center gap-3 bg-panel px-3 py-3 transition-colors hover:bg-subtle/60 sm:px-4">
      <div className="w-12 shrink-0 text-center">
        <p className="text-2xs uppercase tracking-wide text-faint">
          {date ? new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date) : '—'}
        </p>
        <p className={cn('text-lg font-semibold leading-tight tabular-nums', past ? 'text-muted' : 'text-fg')}>
          {date ? date.getDate() : '—'}
        </p>
      </div>

      <button
        type="button"
        onClick={() => ui.openInterviewEditor({ interview })}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-base font-medium text-fg">
            {INTERVIEW_TYPE_META[interview.type].label} interview
          </span>
          <Badge tone={INTERVIEW_OUTCOME_META[interview.outcome].tone}>
            {INTERVIEW_OUTCOME_META[interview.outcome].label}
          </Badge>
          {!interview.followUpSent && past && <Badge tone="caution">Follow-up due</Badge>}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {opportunity ? `${opportunity.company} · ${opportunity.role}` : 'Opportunity removed'}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-faint">
          <span className="tabular-nums">
            {formatDate(interview.scheduledAt)} at {formatTime(interview.scheduledAt)}
          </span>
          <span>· {interview.durationMinutes} min</span>
          <span className="inline-flex items-center gap-1">
            <Video className="h-3 w-3" aria-hidden />
            {interview.format}
          </span>
          {people.length > 0 && <span className="truncate">· {people.join(', ')}</span>}
        </p>
      </button>

      {past && (interview.debriefedAt || debriefIsDue(interview) || interview.outcome === 'pending') && (
        <div className="hidden w-36 shrink-0 lg:block">
          {interview.debriefedAt ? (
            <p className="text-2xs text-muted">
              {interview.askedQuestions?.length ? (
                <>
                  <span className="tabular-nums text-fg">{interview.askedQuestions.length}</span>{' '}
                  {interview.askedQuestions.length === 1 ? 'question' : 'questions'} recorded
                </>
              ) : (
                'Debriefed'
              )}
            </p>
          ) : (
            <p className="text-2xs text-caution">Not debriefed yet</p>
          )}
          {interview.outcome === 'pending' && (
            <p className="mt-0.5 text-2xs text-faint">No result recorded</p>
          )}
        </div>
      )}

      {!past && interview.checklist.length > 0 && (
        <div className="hidden w-24 shrink-0 md:block">
          <p className="text-2xs text-faint">
            Prep {done}/{interview.checklist.length}
          </p>
          <Meter
            className="mt-1"
            value={done}
            max={interview.checklist.length}
            tone={done === interview.checklist.length ? 'positive' : 'accent'}
            label="Prep progress"
          />
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        {past && interview.outcome === 'pending' && (
          <Button
            size="sm"
            variant="secondary"
            icon={<CircleHelp />}
            onClick={() => ui.openOutcomePrompt(interview.id)}
          >
            <span className="hidden sm:inline">Result</span>
          </Button>
        )}
        {past && (
          <Button
            size="sm"
            variant={interview.debriefedAt ? 'ghost' : 'secondary'}
            icon={<ClipboardList />}
            onClick={() => ui.openDebrief(interview.id)}
          >
            <span className="hidden sm:inline">Debrief</span>
          </Button>
        )}
        {showFollowUpAction && (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<PenLine />}
              onClick={() => ui.openComposer({ kind: 'interview', interviewId: interview.id })}
            >
              <span className="hidden sm:inline">Draft</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Send />}
              onClick={async () => {
                await updateInterview(interview.id, { followUpSent: true })
                toast.success('Follow-up recorded')
              }}
            >
              <span className="hidden md:inline">Mark sent</span>
            </Button>
          </>
        )}
        {!past && !showFollowUpAction && (
          <Button
            size="sm"
            variant="secondary"
            icon={<FileText />}
            onClick={() => ui.openPrepSheet(interview.id)}
          >
            <span className="hidden sm:inline">Prep sheet</span>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => ui.openInterviewEditor({ interview })}>
          {past ? 'Review' : 'Edit'}
        </Button>
      </div>
    </li>
  )
}
