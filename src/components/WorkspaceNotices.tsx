import * as React from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Download, Gauge, ShieldAlert, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { usePreferences } from '@/state/preferences'
import { useWorkspace } from '@/state/workspace'
import {
  buildWorkspaceExport,
  describeBackupHealth,
  downloadFile,
  markBackupTaken,
  timestampedFilename,
} from '@/lib/backup'
import { profileIsUsable } from '@/lib/fit'
import { reviewIsDue } from '@/lib/review'
import { useAppUi } from '@/state/app-ui'
import { cn, daysSince } from '@/lib/utils'

/**
 * Two standing risks a local-first job tracker owes the user a word about: the
 * workspace exists in one browser and nowhere else, and fit scoring does
 * nothing until the profile is filled in. Both notices are dismissible, both
 * stay quiet until they matter, and neither repeats once acted on.
 */
export function WorkspaceNotices() {
  const workspace = useWorkspace()
  const ui = useAppUi()
  const { prefs, update } = usePreferences()
  const toast = useToast()
  const [exporting, setExporting] = React.useState(false)

  const recordCount =
    workspace.opportunities.length + workspace.contacts.length + workspace.stories.length

  const oldest = workspace.opportunities.reduce<string | undefined>(
    (earliest, o) => (!earliest || o.createdAt < earliest ? o.createdAt : earliest),
    undefined,
  )
  const health = describeBackupHealth(
    workspace.settings.lastBackupAt,
    recordCount,
    daysSince(workspace.settings.workspaceStartedAt ?? oldest),
  )

  const snoozedDays = daysSince(prefs.backupNudgeDismissedAt)
  const backupSnoozed = snoozedDays !== null && snoozedDays < 7
  const showBackup = health.nudge && !backupSnoozed

  const showProfile =
    !prefs.profileNudgeDismissed &&
    !profileIsUsable(workspace.profile) &&
    workspace.opportunities.length >= 3

  const showReview =
    workspace.opportunities.length >= 3 && reviewIsDue(workspace.settings.lastReviewAt, oldest)

  if (!showBackup && !showProfile && !showReview) return null

  return (
    <div className="space-y-2 px-4 pt-4 sm:px-6">
      {showBackup && (
        <Notice
          tone="caution"
          icon={<ShieldAlert />}
          title={
            health.state === 'never'
              ? 'This workspace has never been exported'
              : `Your last backup was ${health.days} days ago`
          }
          body="Everything you have tracked lives in this browser. Clearing site data or switching machines would take it with it."
          onDismiss={() => update({ backupNudgeDismissedAt: new Date().toISOString() })}
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Download />}
              loading={exporting}
              onClick={async () => {
                setExporting(true)
                try {
                  const payload = await buildWorkspaceExport()
                  downloadFile(
                    timestampedFilename('opportunity-os-workspace', 'json'),
                    JSON.stringify(payload, null, 2),
                    'application/json',
                  )
                  await markBackupTaken()
                  toast.success('Workspace exported', 'Keep the file somewhere outside this browser.')
                } catch (error) {
                  toast.error('Export failed', error instanceof Error ? error.message : undefined)
                } finally {
                  setExporting(false)
                }
              }}
            >
              Export now
            </Button>
          }
        />
      )}

      {showReview && (
        <Notice
          tone="accent"
          icon={<CalendarCheck />}
          title="Your weekly review is due"
          body="Seven days in one pass: what moved, what has gone quiet, and a decision on each stalled role. It takes a few minutes and it is the part that keeps a pipeline honest."
          onDismiss={() =>
            void import('@/lib/repo').then((m) =>
              m.updateSettings({ lastReviewAt: new Date().toISOString() }),
            )
          }
          action={
            <Button size="sm" variant="secondary" onClick={() => ui.openReview()}>
              Start the review
            </Button>
          }
        />
      )}

      {showProfile && (
        <Notice
          tone="accent"
          icon={<Gauge />}
          title="Fit scoring is off"
          body="Add your target roles, skills and compensation floor and every opportunity gets a transparent score you can inspect. Nothing is guessed from what you have not entered."
          onDismiss={() => update({ profileNudgeDismissed: true })}
          action={
            <Link
              to="/settings"
              className="inline-flex h-7 items-center rounded-md border border-line bg-panel px-2.5 text-xs font-medium text-fg shadow-xs transition-colors hover:bg-subtle"
            >
              Set up your profile
            </Link>
          }
        />
      )}
    </div>
  )
}

function Notice({
  tone,
  icon,
  title,
  body,
  action,
  onDismiss,
}: {
  tone: 'caution' | 'accent'
  icon: React.ReactNode
  title: string
  body: string
  action: React.ReactNode
  onDismiss: () => void
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-lg border px-3.5 py-3',
        tone === 'caution' ? 'border-caution/40 bg-caution-soft/50' : 'border-accent/30 bg-accent-soft/50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4',
          tone === 'caution' ? 'text-caution' : 'text-accent',
        )}
        aria-hidden
      >
        {icon}
      </span>
      {/* The minimum width is what makes the notice wrap sensibly: rather than
          squeezing the sentence into a ragged column beside the button, the
          button drops to its own line once the text would get too narrow. */}
      <div className="min-w-[15rem] flex-1">
        <p className="text-base font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {action}
        <IconButton label="Dismiss this notice" size="sm" onClick={onDismiss}>
          <X />
        </IconButton>
      </div>
    </div>
  )
}
