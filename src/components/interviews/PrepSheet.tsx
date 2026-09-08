import * as React from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import { CalendarPlus, Copy, Ear, Printer, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { SHARPNESS_META, sharpnessOf } from '@/lib/rehearsal'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { buildIcs } from '@/lib/calendar'
import { downloadFile } from '@/lib/backup'
import { parseJobDescription } from '@/lib/parse'
import { INTERVIEW_TYPE_META, WORK_ARRANGEMENT_LABEL } from '@/lib/types'
import {
  copyText,
  formatDate,
  formatLongDate,
  formatSalaryRange,
  formatTime,
  cn,
} from '@/lib/utils'

/**
 * A single-page brief for one interview: who, when, what they will probably
 * ask, what you want to ask them, and the stories you have decided to tell —
 * assembled from records you already keep, so nothing has to be hunted down on
 * the morning of. Printable, copyable, and exportable to a calendar.
 */
export function PrepSheet() {
  const ui = useAppUi()
  const toast = useToast()
  const workspace = useWorkspace()

  const interview = ui.prepSheet.interviewId
    ? workspace.interviewsById.get(ui.prepSheet.interviewId)
    : undefined
  const opportunity = interview ? workspace.byId.get(interview.opportunityId) : undefined
  const fit = opportunity ? workspace.fit.get(opportunity.id) : undefined
  const people = (interview?.contactIds ?? [])
    .map((id) => workspace.contactsById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
  const stories = (interview?.storyIds ?? [])
    .map((id) => workspace.storiesById.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
  const parsed = React.useMemo(
    () => (opportunity?.jobDescription ? parseJobDescription(opportunity.jobDescription) : null),
    [opportunity?.jobDescription],
  )

  if (!interview || !opportunity) {
    return (
      <RDialog.Root open={ui.prepSheet.open} onOpenChange={(open) => !open && ui.closePrepSheet()}>
        <RDialog.Portal>
          <RDialog.Overlay className="fixed inset-0 z-50 bg-[hsl(var(--shadow)/0.32)]" />
          <RDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-panel p-5 shadow-xl">
            <RDialog.Title className="text-md font-semibold text-fg">Prep sheet unavailable</RDialog.Title>
            <RDialog.Description className="mt-1 text-sm text-muted">
              This interview or its opportunity is no longer in the workspace.
            </RDialog.Description>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => ui.closePrepSheet()}>Close</Button>
            </div>
          </RDialog.Content>
        </RDialog.Portal>
      </RDialog.Root>
    )
  }

  const asPlainText = (): string => {
    const lines: string[] = [
      `${INTERVIEW_TYPE_META[interview.type].label} interview — ${opportunity.company}`,
      `${opportunity.role}`,
      `${formatLongDate(interview.scheduledAt)} at ${formatTime(interview.scheduledAt)} · ${interview.durationMinutes} min · ${interview.format}`,
    ]
    if (people.length > 0) {
      lines.push(`With: ${people.map((p) => `${p.name}${p.title ? ` (${p.title})` : ''}`).join(', ')}`)
    }
    if (interview.interviewers) lines.push(interview.interviewers)
    lines.push('')
    if (opportunity.whyInterested) lines.push('WHY THIS ROLE', opportunity.whyInterested, '')
    if (opportunity.strengths) lines.push('MY CASE', opportunity.strengths, '')
    if (opportunity.concerns) lines.push('WHAT I NEED TO FIND OUT', opportunity.concerns, '')
    if (interview.questionsExpected.length > 0) {
      lines.push('THEY MAY ASK', ...interview.questionsExpected.map((q, i) => `${i + 1}. ${q}`), '')
    }
    if (interview.questionsToAsk.length > 0) {
      lines.push('I WILL ASK', ...interview.questionsToAsk.map((q, i) => `${i + 1}. ${q}`), '')
    }
    if (stories.length > 0) {
      lines.push('STORIES READY')
      for (const s of stories) {
        lines.push(`• ${s.title}`)
        if (s.metrics) lines.push(`  ${s.metrics}`)
      }
      lines.push('')
    }
    if (interview.prepNotes) lines.push('NOTES', interview.prepNotes)
    return lines.join('\n')
  }

  const exportIcs = () => {
    const ics = buildIcs([{ interview, opportunity, interviewerNames: people.map((p) => p.name) }])
    const stamp = formatDate(interview.scheduledAt).replace(/\s/g, '-')
    downloadFile(
      `interview-${opportunity.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}.ics`,
      ics,
      'text/calendar',
    )
    toast.success('Calendar file downloaded', 'Open it to add the interview to your calendar.')
  }

  return (
    <RDialog.Root open={ui.prepSheet.open} onOpenChange={(open) => !open && ui.closePrepSheet()}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[hsl(var(--shadow)/0.32)] backdrop-blur-[1px] data-[state=open]:animate-fade-in print:hidden" />
        <RDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[min(92vh,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-3xl',
            '-translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-xl',
            'data-[state=open]:animate-scale-in',
          )}
        >
          <RDialog.Title className="sr-only">
            Interview prep sheet for {opportunity.role} at {opportunity.company}
          </RDialog.Title>

          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5 print:hidden">
            <p className="text-sm font-medium text-fg">Prep sheet</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" icon={<CalendarPlus />} onClick={exportIcs}>
                <span className="hidden sm:inline">Add to calendar</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy />}
                onClick={async () => {
                  const ok = await copyText(asPlainText())
                  if (ok) toast.success('Prep sheet copied as text')
                  else toast.error('Could not reach the clipboard')
                }}
              >
                <span className="hidden sm:inline">Copy</span>
              </Button>
              <Button size="sm" variant="primary" icon={<Printer />} onClick={() => window.print()}>
                <span className="hidden sm:inline">Print</span>
              </Button>
              <IconButton label="Close prep sheet" size="sm" onClick={() => ui.closePrepSheet()}>
                <X />
              </IconButton>
            </div>
          </header>

          <div id="print-root" className="min-h-0 flex-1 overflow-y-auto px-6 py-5 print:overflow-visible">
            <header className="border-b border-line pb-3">
              <p className="text-sm font-medium text-muted">{opportunity.company}</p>
              <h1 className="mt-0.5 text-balance text-xl font-semibold tracking-[-0.015em] text-fg">
                {opportunity.role}
              </h1>
              <p className="mt-1.5 text-base text-fg">
                <span className="font-medium">{INTERVIEW_TYPE_META[interview.type].label} interview</span>
                <span className="text-muted">
                  {' · '}
                  {formatLongDate(interview.scheduledAt)} at {formatTime(interview.scheduledAt)}
                  {' · '}
                  {interview.durationMinutes} min · {interview.format}
                </span>
              </p>
              {(people.length > 0 || interview.interviewers) && (
                <p className="mt-1 text-sm text-muted">
                  With{' '}
                  {people.map((p) => `${p.name}${p.title ? ` (${p.title})` : ''}`).join(', ')}
                  {people.length > 0 && interview.interviewers ? ' · ' : ''}
                  {interview.interviewers}
                </p>
              )}
            </header>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-line py-3 sm:grid-cols-4">
              <Fact label="Compensation">
                {formatSalaryRange(opportunity.salaryMin, opportunity.salaryMax, opportunity.currency)}
              </Fact>
              <Fact label="Location">
                {opportunity.location || WORK_ARRANGEMENT_LABEL[opportunity.workArrangement]}
              </Fact>
              <Fact label="Fit">{fit?.score === null || fit === undefined ? '—' : `${fit.score} / 100`}</Fact>
              <Fact label="Experience asked for">
                {parsed?.years ? `${parsed.years.min}+ years` : 'Not stated'}
              </Fact>
            </dl>

            <div className="grid gap-5 py-4 sm:grid-cols-2">
              <Block title="Why this role">{opportunity.whyInterested}</Block>
              <Block title="My case">{opportunity.strengths}</Block>
              <Block title="What I need to find out">{opportunity.concerns}</Block>
              <Block title="Skills the posting names">
                {parsed && parsed.requiredSkills.length > 0
                  ? parsed.requiredSkills.slice(0, 10).join(', ')
                  : undefined}
              </Block>
            </div>

            <div className="grid gap-5 border-t border-line py-4 sm:grid-cols-2">
              <QuestionList title="They may ask" items={interview.questionsExpected} />
              <QuestionList title="I will ask" items={interview.questionsToAsk} />
            </div>

            {stories.length > 0 && (
              <section className="border-t border-line py-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="section-title">Stories ready</h2>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Ear />}
                    className="print:hidden"
                    onClick={() => {
                      ui.closePrepSheet()
                      ui.openRehearsal({ interviewId: interview.id })
                    }}
                  >
                    Rehearse these
                  </Button>
                </div>
                <ul className="space-y-2.5">
                  {stories.map((story) => (
                    <li key={story.id} className="break-inside-avoid">
                      <p className="text-base font-medium text-fg">
                        {story.title}
                        <span
                          className={cn(
                            'ml-2 align-middle text-2xs font-normal',
                            sharpnessOf(story) === 'sharp'
                              ? 'text-positive'
                              : sharpnessOf(story) === 'shaky'
                                ? 'text-caution'
                                : 'text-faint',
                          )}
                        >
                          {SHARPNESS_META[sharpnessOf(story)].label}
                        </span>
                      </p>
                      {story.result && (
                        <p className="mt-0.5 text-sm leading-relaxed text-muted">{story.result}</p>
                      )}
                      {story.metrics && (
                        <p className="mt-0.5 text-sm font-medium tabular-nums text-positive">{story.metrics}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {interview.checklist.some((c) => !c.done) && (
              <section className="border-t border-line py-4 print:hidden">
                <h2 className="section-title mb-2">Still to do</h2>
                <ul className="space-y-1">
                  {interview.checklist
                    .filter((c) => !c.done)
                    .map((c) => (
                      <li key={c.id} className="flex items-baseline gap-2 text-base text-fg">
                        <span className="h-3 w-3 shrink-0 translate-y-0.5 rounded-sm border border-line-strong" aria-hidden />
                        {c.text}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {interview.prepNotes && (
              <section className="border-t border-line py-4">
                <h2 className="section-title mb-2">Notes</h2>
                <p className="whitespace-pre-wrap text-base leading-relaxed text-fg">{interview.prepNotes}</p>
              </section>
            )}

            <p className="hidden border-t border-line pt-3 text-2xs text-faint print:block">
              Prepared with Opportunity OS · {formatLongDate(new Date().toISOString())}
            </p>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs uppercase tracking-wide text-faint">{label}</dt>
      <dd className="truncate text-base tabular-nums text-fg">{children}</dd>
    </div>
  )
}

function Block({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="section-title mb-1">{title}</h2>
      {children ? (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-fg">{children}</p>
      ) : (
        <p className="text-sm text-faint">Not recorded.</p>
      )}
    </section>
  )
}

function QuestionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="section-title mb-1.5">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-faint">Nothing written down yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex gap-2 text-base leading-relaxed text-fg">
              <span className="shrink-0 tabular-nums text-faint">{i + 1}.</span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
