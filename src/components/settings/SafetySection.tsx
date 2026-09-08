import * as React from 'react'
import {
  CircleCheck,
  History,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Badge, Button, IconButton, Spinner } from '@/components/ui/primitives'
import { ConfirmDialog } from '@/components/ui/overlay'
import { useToast } from '@/components/ui/toast'
import { useWorkspace } from '@/state/workspace'
import {
  AUTO_INTERVAL_HOURS,
  checkPersistence,
  deleteAllSnapshots,
  deleteSnapshot,
  listSnapshots,
  readSnapshot,
  requestPersistence,
  snapshotStorageBytes,
  takeSnapshot,
  type PersistenceState,
  type SnapshotSummary,
} from '@/lib/snapshots'
import { restoreWorkspace, validateWorkspace } from '@/lib/backup'
import { checkIntegrity, loadForIntegrityCheck, type IntegrityReport } from '@/lib/integrity'
import { SNAPSHOT_REASON_LABEL } from '@/lib/types'
import { cn, formatAgo, formatDateTime, pluralize } from '@/lib/utils'

/**
 * Everything that keeps a browser-only workspace from quietly disappearing:
 * whether the browser has promised not to evict it, the local restore points,
 * and a check for references that have gone stale.
 */
export function SafetySection() {
  const toast = useToast()
  const workspace = useWorkspace()
  const [persistence, setPersistence] = React.useState<PersistenceState | null>(null)
  const [requesting, setRequesting] = React.useState(false)
  const [snapshots, setSnapshots] = React.useState<SnapshotSummary[] | null>(null)
  const [snapshotBytes, setSnapshotBytes] = React.useState(0)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = React.useState<SnapshotSummary | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = React.useState(false)
  const [report, setReport] = React.useState<IntegrityReport | null>(null)
  const [checking, setChecking] = React.useState(false)

  const refresh = React.useCallback(async () => {
    const [list, bytes] = await Promise.all([listSnapshots(), snapshotStorageBytes()])
    setSnapshots(list)
    setSnapshotBytes(bytes)
  }, [])

  React.useEffect(() => {
    void checkPersistence().then(setPersistence)
    void refresh()
  }, [refresh])

  const runCheck = async () => {
    setChecking(true)
    try {
      setReport(checkIntegrity(await loadForIntegrityCheck()))
    } finally {
      setChecking(false)
    }
  }

  const brokenCount = report?.issues.filter((i) => i.severity === 'broken').length ?? 0

  return (
    <div className="space-y-8">
      {/* ----------------------------- durability ---------------------------- */}
      <section>
        <h2 className="text-md font-semibold text-fg">Storage durability</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Browsers may clear storage for sites they consider disposable, usually when the device is short on
          space. Asking for persistent storage tells the browser this site's data is worth keeping.
        </p>

        <div
          className={cn(
            'mt-3 flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-3',
            persistence === 'persisted'
              ? 'border-positive/30 bg-positive-soft/50'
              : persistence === 'transient'
                ? 'border-caution/40 bg-caution-soft/60'
                : 'border-line bg-subtle/60',
          )}
        >
          {persistence === null ? (
            <Spinner />
          ) : persistence === 'persisted' ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-positive" aria-hidden />
          ) : (
            <TriangleAlert className="h-4 w-4 shrink-0 text-caution" aria-hidden />
          )}
          <p className="min-w-0 flex-1 text-sm text-fg">
            {persistence === 'persisted' ? (
              <>
                <span className="font-medium">Storage is persistent.</span>{' '}
                <span className="text-muted">
                  This browser has agreed not to evict your workspace automatically. Clearing site data by hand
                  still removes it.
                </span>
              </>
            ) : persistence === 'transient' ? (
              <>
                <span className="font-medium">Storage is not persistent.</span>{' '}
                <span className="text-muted">
                  Your workspace could be evicted if the device runs low on space.
                </span>
              </>
            ) : persistence === 'unsupported' ? (
              <span className="text-muted">This browser does not expose storage persistence.</span>
            ) : (
              <span className="text-muted">Checking…</span>
            )}
          </p>
          {persistence === 'transient' && (
            <Button
              size="sm"
              variant="secondary"
              loading={requesting}
              onClick={async () => {
                setRequesting(true)
                try {
                  const next = await requestPersistence()
                  setPersistence(next)
                  if (next === 'persisted') toast.success('Storage is now persistent')
                  else {
                    toast.toast({
                      title: 'The browser declined',
                      description:
                        'Some browsers only grant this after repeated use, or once the app is installed. Keep exporting backups.',
                      tone: 'warning',
                    })
                  }
                } finally {
                  setRequesting(false)
                }
              }}
            >
              Request persistence
            </Button>
          )}
        </div>
      </section>

      {/* --------------------------- restore points -------------------------- */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-md font-semibold text-fg">Restore points</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              A full copy of the workspace kept inside this browser. One is taken automatically every{' '}
              {AUTO_INTERVAL_HOURS} hours and before anything destructive, so a bad import or an accidental
              clear can be undone. They are not part of an export file.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={<History />}
            loading={busy === 'take'}
            onClick={async () => {
              setBusy('take')
              try {
                const created = await takeSnapshot('manual')
                await refresh()
                if (created) toast.success('Restore point saved')
                else toast.toast({ title: 'Nothing to save yet', description: 'Add a few records first.' })
              } finally {
                setBusy(null)
              }
            }}
          >
            Take one now
          </Button>
        </div>

        {snapshots === null ? (
          <div className="mt-3 flex justify-center py-6">
            <Spinner />
          </div>
        ) : snapshots.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
            No restore points yet. One is written automatically once the workspace has a few records in it.
          </p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {snapshots.map((snapshot) => (
                <li key={snapshot.id} className="flex flex-wrap items-center gap-3 bg-panel px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-medium text-fg">{formatDateTime(snapshot.at)}</p>
                      <Badge tone={snapshot.reason === 'automatic' ? 'neutral' : 'info'}>
                        {SNAPSHOT_REASON_LABEL[snapshot.reason]}
                      </Badge>
                      <span className="text-xs text-faint">{formatAgo(snapshot.at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {snapshot.counts.opportunities ?? 0} opportunities · {snapshot.counts.contacts ?? 0}{' '}
                      contacts · {snapshot.counts.interviews ?? 0} interviews · {snapshot.counts.stories ?? 0}{' '}
                      stories · {formatBytes(snapshot.bytes)}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setRestoreTarget(snapshot)}>
                    Restore
                  </Button>
                  <IconButton
                    label={`Delete the restore point from ${formatDateTime(snapshot.at)}`}
                    size="sm"
                    onClick={async () => {
                      await deleteSnapshot(snapshot.id)
                      await refresh()
                      toast.success('Restore point deleted')
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-faint">
                {snapshots.length} {pluralize(snapshots.length, 'restore point')} using {formatBytes(snapshotBytes)}
              </p>
              <Button size="xs" variant="ghost" onClick={() => setConfirmDeleteAll(true)}>
                Delete all restore points
              </Button>
            </div>
          </>
        )}
      </section>

      {/* ---------------------------- integrity ------------------------------ */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-md font-semibold text-fg">Check the workspace</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              Looks for references that point at records which no longer exist, and for states that quietly
              distort the analytics. Nothing is changed unless you ask for it.
            </p>
          </div>
          <Button size="sm" variant="secondary" icon={<Stethoscope />} loading={checking} onClick={() => void runCheck()}>
            Run the check
          </Button>
        </div>

        {report && (
          <div className="mt-3 space-y-2">
            {report.issues.length === 0 ? (
              <div className="flex items-start gap-3 rounded-lg border border-positive/30 bg-positive-soft/50 p-3.5">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
                <div>
                  <p className="text-base font-medium text-fg">Everything checks out</p>
                  <p className="mt-0.5 text-sm text-muted">
                    Scanned {report.scanned.opportunities} opportunities, {report.scanned.contacts} contacts,{' '}
                    {report.scanned.interviews} interviews, {report.scanned.stories} stories and{' '}
                    {report.scanned.activity} activity entries.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted">
                  {report.issues.length} {pluralize(report.issues.length, 'finding')}
                  {brokenCount > 0 && `, ${brokenCount} of which ${brokenCount === 1 ? 'breaks' : 'break'} a reference`}
                  .
                </p>
                <ul className="space-y-2">
                  {report.issues.map((issue) => (
                    <li
                      key={issue.id}
                      className={cn(
                        'flex flex-wrap items-start gap-3 rounded-lg border px-3.5 py-3',
                        issue.severity === 'broken'
                          ? 'border-critical/35 bg-critical-soft/50'
                          : issue.severity === 'inconsistent'
                            ? 'border-caution/40 bg-caution-soft/50'
                            : 'border-line bg-subtle/60',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium text-fg">{issue.title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted">{issue.detail}</p>
                      </div>
                      {issue.repair && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busy === issue.id}
                          onClick={async () => {
                            setBusy(issue.id)
                            try {
                              await takeSnapshot('manual')
                              await issue.repair?.()
                              await runCheck()
                              await refresh()
                              toast.success(issue.repairLabel ?? 'Repaired', 'A restore point was saved first.')
                            } finally {
                              setBusy(null)
                            }
                          }}
                        >
                          {issue.repairLabel ?? 'Repair'}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="text-xs text-faint">Checked {formatAgo(report.checkedAt)}.</p>
          </div>
        )}
      </section>

      {/* ----------------------------- dialogs ------------------------------- */}
      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title="Restore this point?"
        destructive
        confirmLabel="Replace the workspace"
        body={
          restoreTarget && (
            <>
              <p>
                The workspace goes back to how it was on{' '}
                <strong className="text-fg">{formatDateTime(restoreTarget.at)}</strong> —{' '}
                {restoreTarget.counts.opportunities ?? 0} opportunities, {restoreTarget.counts.contacts ?? 0}{' '}
                contacts, {restoreTarget.counts.interviews ?? 0} interviews.
              </p>
              <p>
                Anything added since then is replaced. A restore point for the current state is saved first, so
                this is reversible.
              </p>
            </>
          )
        }
        onConfirm={async () => {
          if (!restoreTarget) return
          const raw = await readSnapshot(restoreTarget.id)
          const validation = validateWorkspace(raw)
          if (!validation.ok || !validation.payload) {
            toast.error('That restore point could not be read', validation.fatal ?? undefined)
            return
          }
          await restoreWorkspace(validation.payload, 'replace')
          await refresh()
          toast.success('Workspace restored', `Back to ${formatDateTime(restoreTarget.at)}.`)
        }}
      />

      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Delete every restore point?"
        destructive
        confirmLabel="Delete them all"
        body={
          <p>
            Your current workspace is untouched, but you lose the ability to roll back to any earlier state.
            Exported backup files are unaffected.
          </p>
        }
        onConfirm={async () => {
          await deleteAllSnapshots()
          await refresh()
          toast.success('Restore points deleted')
        }}
      />

      <p className="flex items-center gap-1.5 border-t border-line pt-4 text-xs text-faint">
        <RotateCcw className="h-3 w-3" aria-hidden />
        Restore points live in this browser alongside the workspace they protect. For protection against losing
        the browser itself, export a backup from the Data tab.
      </p>

      {/* Referenced so the workspace subscription keeps this section live. */}
      <span className="sr-only">{workspace.opportunities.length} records tracked</span>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
