import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { Button, Badge } from '@/components/ui/primitives'
import { ConfirmDialog, Modal } from '@/components/ui/overlay'
import { Field, Select } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { useWorkspace } from '@/state/workspace'
import {
  buildWorkspaceExport,
  describeBackupHealth,
  downloadFile,
  markBackupTaken,
  restoreWorkspace,
  timestampedFilename,
  validateWorkspace,
  type RestoreMode,
  type ValidationReport,
} from '@/lib/backup'
import { clearAllData, estimateStorage } from '@/lib/db'
import { takeSnapshot } from '@/lib/snapshots'
import { CaptureSection } from './CaptureSection'
import { createContact, createOpportunity } from '@/lib/repo'
import {
  CONTACT_CSV_HEADERS,
  OPPORTUNITY_CSV_HEADERS,
  contactToRow,
  importContactsCsv,
  importOpportunitiesCsv,
  opportunityToRow,
  toCsv,
  type ContactCsvImportResult,
  type CsvImportResult,
} from '@/lib/csv'
import { RELATIONSHIP_META, STAGE_META } from '@/lib/types'
import { cn, formatDateTime, pluralize } from '@/lib/utils'

const MAX_FILE_BYTES = 60 * 1024 * 1024

export function DataSection() {
  const toast = useToast()
  const workspace = useWorkspace()
  const [storage, setStorage] = React.useState<{ usage: number; quota: number } | null>(null)
  const [restoreReport, setRestoreReport] = React.useState<ValidationReport | null>(null)
  const [restoreMode, setRestoreMode] = React.useState<RestoreMode>('replace')
  const [csvReport, setCsvReport] = React.useState<
    | { kind: 'opportunities'; result: CsvImportResult }
    | { kind: 'contacts'; result: ContactCsvImportResult }
    | null
  >(null)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const [confirmDemo, setConfirmDemo] = React.useState(false)
  const [alsoDeleteSnapshots, setAlsoDeleteSnapshots] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const health = describeBackupHealth(
    workspace.settings.lastBackupAt,
    workspace.opportunities.length + workspace.contacts.length + workspace.stories.length,
  )
  const jsonInputRef = React.useRef<HTMLInputElement>(null)
  const csvInputRef = React.useRef<HTMLInputElement>(null)
  const contactCsvInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    void estimateStorage().then(setStorage)
  }, [workspace.opportunities.length, workspace.events.length])

  const readFile = async (file: File): Promise<string | null> => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error('That file is too large', `Files up to ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB are supported.`)
      return null
    }
    try {
      return await file.text()
    } catch {
      toast.error('Could not read that file', 'The browser refused to open it. Try downloading it again.')
      return null
    }
  }

  const exportJson = async () => {
    setBusy('json')
    try {
      const payload = await buildWorkspaceExport()
      downloadFile(
        timestampedFilename('opportunity-os-workspace', 'json'),
        JSON.stringify(payload, null, 2),
        'application/json',
      )
      await markBackupTaken()
      toast.success('Workspace exported', `${payload.counts.opportunities} opportunities and everything attached to them.`)
    } catch (error) {
      toast.error('Export failed', error instanceof Error ? error.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const exportCsv = () => {
    const rows = workspace.opportunities.map((o) =>
      opportunityToRow(o, workspace.fit.get(o.id)?.score ?? null),
    )
    downloadFile(timestampedFilename('opportunities', 'csv'), toCsv([...OPPORTUNITY_CSV_HEADERS], rows), 'text/csv')
    toast.success(`Exported ${rows.length} ${pluralize(rows.length, 'opportunity', 'opportunities')}`)
  }

  const onJsonFile = async (file: File) => {
    const text = await readFile(file)
    if (text === null) return
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setRestoreReport({
        ok: false,
        fatal: 'That file is not valid JSON. If you edited it by hand, check for a stray comma or quote.',
        warnings: [],
        counts: {},
        payload: null,
      })
      return
    }
    setRestoreMode('replace')
    setRestoreReport(validateWorkspace(parsed))
  }

  const onCsvFile = async (file: File) => {
    const text = await readFile(file)
    if (text === null) return
    setCsvReport({ kind: 'opportunities', result: importOpportunitiesCsv(text) })
  }

  const onContactCsvFile = async (file: File) => {
    const text = await readFile(file)
    if (text === null) return
    setCsvReport({ kind: 'contacts', result: importContactsCsv(text) })
  }

  const exportContactsCsv = () => {
    const rows = workspace.contacts.map(contactToRow)
    downloadFile(timestampedFilename('contacts', 'csv'), toCsv([...CONTACT_CSV_HEADERS], rows), 'text/csv')
    toast.success(`Exported ${rows.length} ${pluralize(rows.length, 'contact')}`)
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-md font-semibold text-fg">Back up and restore</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Your workspace lives in this browser only. Export it regularly — a backup is the only copy that
          survives clearing site data, switching machines or reinstalling a browser.
        </p>

        {health.state !== 'none-needed' && (
          <div
            className={cn(
              'mt-3 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5',
              health.state === 'fresh'
                ? 'border-positive/30 bg-positive-soft/50'
                : 'border-caution/40 bg-caution-soft/60',
            )}
          >
            {health.state === 'fresh' ? (
              <ShieldCheck className="h-4 w-4 shrink-0 text-positive" aria-hidden />
            ) : (
              <TriangleAlert className="h-4 w-4 shrink-0 text-caution" aria-hidden />
            )}
            <p className="min-w-0 flex-1 text-sm text-fg">
              <span className="font-medium">{health.label}.</span>{' '}
              <span className="text-muted">
                {health.state === 'fresh'
                  ? 'Keep the file somewhere outside this browser.'
                  : 'Everything you have added since then exists only in this browser.'}
              </span>
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DataCard
            icon={<FileJson />}
            title="Export everything"
            description="One JSON file with opportunities, contacts, interviews, stories, activity, saved views and your profile."
            action={
              <Button variant="primary" icon={<Download />} loading={busy === 'json'} onClick={() => void exportJson()}>
                Export workspace
              </Button>
            }
          />
          <DataCard
            icon={<Upload />}
            title="Restore from a backup"
            description="Validated field by field before anything is written. You choose whether to replace or merge."
            action={
              <>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void onJsonFile(file)
                    e.target.value = ''
                  }}
                />
                <Button variant="secondary" icon={<Upload />} onClick={() => jsonInputRef.current?.click()}>
                  Choose a JSON file
                </Button>
              </>
            }
          />
        </div>
      </section>

      <section>
        <h2 className="text-md font-semibold text-fg">Spreadsheets</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          For moving individual lists in or out. A CSV carries the columns below and nothing else — use the
          JSON export above if you want the whole workspace.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DataCard
            icon={<FileSpreadsheet />}
            title="Export opportunities as CSV"
            description="Every opportunity with its fit score, for a spreadsheet or another tracker."
            action={
              <Button
                variant="secondary"
                icon={<Download />}
                onClick={exportCsv}
                disabled={workspace.opportunities.length === 0}
              >
                Export CSV
              </Button>
            }
          />
          <DataCard
            icon={<FileSpreadsheet />}
            title="Import opportunities from CSV"
            description="Bring a spreadsheet across. Company and Role columns are required; the rest is matched by name."
            action={
              <>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept="text/csv,.csv,text/plain"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void onCsvFile(file)
                    e.target.value = ''
                  }}
                />
                <Button variant="secondary" icon={<Upload />} onClick={() => csvInputRef.current?.click()}>
                  Choose a CSV file
                </Button>
              </>
            }
          />
          <DataCard
            icon={<FileSpreadsheet />}
            title="Export contacts as CSV"
            description="Names, relationships, companies and follow-up dates, for a spreadsheet or another CRM."
            action={
              <Button
                variant="secondary"
                icon={<Download />}
                onClick={exportContactsCsv}
                disabled={workspace.contacts.length === 0}
              >
                Export CSV
              </Button>
            }
          />
          <DataCard
            icon={<FileSpreadsheet />}
            title="Import contacts from CSV"
            description="Bring a network list across. Only a Name column is required; first and last name columns work too."
            action={
              <>
                <input
                  ref={contactCsvInputRef}
                  type="file"
                  accept="text/csv,.csv,text/plain"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void onContactCsvFile(file)
                    e.target.value = ''
                  }}
                />
                <Button variant="secondary" icon={<Upload />} onClick={() => contactCsvInputRef.current?.click()}>
                  Choose a CSV file
                </Button>
              </>
            }
          />
        </div>
      </section>

      <CaptureSection />

      <section>
        <h2 className="text-md font-semibold text-fg">This workspace</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 rounded-lg border border-line bg-subtle/50 p-4 sm:grid-cols-3">
          <Metric label="Opportunities" value={workspace.opportunities.length} />
          <Metric label="Contacts" value={workspace.contacts.length} />
          <Metric label="Interviews" value={workspace.interviews.length} />
          <Metric label="Stories" value={workspace.stories.length} />
          <Metric label="Activity entries" value={workspace.events.length} />
          <Metric
            label="Storage used"
            value={storage ? formatBytes(storage.usage) : '—'}
            sub={storage && storage.quota > 0 ? `of about ${formatBytes(storage.quota)} available` : undefined}
          />
        </dl>
      </section>

      <section>
        <h2 className="text-md font-semibold text-fg">Demo workspace</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Fifteen fictional opportunities, ten contacts, five interviews and eight stories, with enough history
          to make every screen meaningful. Loading it replaces everything currently in this workspace.
        </p>
        <Button className="mt-3" variant="secondary" icon={<Database />} onClick={() => setConfirmDemo(true)}>
          Load the demo workspace
        </Button>
      </section>

      <section>
        <h2 className="text-md font-semibold text-critical">Clear this workspace</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Permanently deletes every opportunity, contact, interview, story and activity entry from this browser.
          This cannot be undone — export a backup first.
        </p>
        <Button className="mt-3" variant="danger" icon={<Trash2 />} onClick={() => setConfirmClear(true)}>
          Clear workspace
        </Button>
      </section>

      {/* -------------------------- Restore dialog -------------------------- */}
      <Modal
        open={restoreReport !== null}
        onOpenChange={(open) => !open && setRestoreReport(null)}
        title="Restore workspace"
        size="lg"
        footer={
          restoreReport?.ok ? (
            <>
              <Button variant="ghost" onClick={() => setRestoreReport(null)}>
                Cancel
              </Button>
              <Button
                variant={restoreMode === 'replace' ? 'danger' : 'primary'}
                loading={busy === 'restore'}
                onClick={async () => {
                  if (!restoreReport?.payload) return
                  setBusy('restore')
                  try {
                    const result = await restoreWorkspace(restoreReport.payload, restoreMode)
                    setRestoreReport(null)
                    toast.success(
                      restoreMode === 'replace' ? 'Workspace restored' : 'Backup merged',
                      `${result.written.opportunities} opportunities, ${result.written.contacts} contacts, ${result.written.interviews} interviews, ${result.written.stories} stories.`,
                    )
                  } catch (error) {
                    toast.error('Restore failed', error instanceof Error ? error.message : undefined)
                  } finally {
                    setBusy(null)
                  }
                }}
              >
                {restoreMode === 'replace' ? 'Replace workspace' : 'Merge into workspace'}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setRestoreReport(null)}>
              Close
            </Button>
          )
        }
      >
        {restoreReport && !restoreReport.ok ? (
          <div className="flex items-start gap-3 rounded-lg border border-critical/40 bg-critical-soft p-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden />
            <div>
              <p className="text-base font-medium text-fg">This file cannot be restored</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{restoreReport.fatal}</p>
            </div>
          </div>
        ) : restoreReport ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-positive/30 bg-positive-soft/60 p-3.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
              <div className="min-w-0">
                <p className="text-base font-medium text-fg">Backup looks valid</p>
                <p className="mt-0.5 text-sm text-muted">
                  {restoreReport.exportedAt
                    ? `Exported ${formatDateTime(restoreReport.exportedAt)}`
                    : 'No export date recorded'}
                  {restoreReport.schemaVersion !== undefined && ` · schema v${restoreReport.schemaVersion}`}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(restoreReport.counts).map(([key, value]) => (
                <div key={key} className="rounded-md border border-line bg-subtle/60 px-3 py-2">
                  <dt className="text-xs capitalize text-muted">{key}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-fg">{value}</dd>
                </div>
              ))}
            </dl>

            {restoreReport.warnings.length > 0 && (
              <div className="rounded-lg border border-caution/40 bg-caution-soft/60 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
                  <AlertTriangle className="h-3.5 w-3.5 text-caution" aria-hidden />
                  {restoreReport.warnings.length} {pluralize(restoreReport.warnings.length, 'record')} needed
                  attention
                </p>
                <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                  {restoreReport.warnings.slice(0, 40).map((warning, i) => (
                    <li key={i} className="text-xs leading-relaxed text-muted">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Field label="How should this be applied?">
              <Select<RestoreMode>
                ariaLabel="Restore mode"
                value={restoreMode}
                onChange={setRestoreMode}
                options={[
                  {
                    value: 'replace',
                    label: 'Replace everything',
                    description: 'Clear this workspace, then write the backup. Your current data is lost.',
                  },
                  {
                    value: 'merge',
                    label: 'Merge into this workspace',
                    description: 'Keep what is here and add the backup alongside it, re-numbering any clashes.',
                  },
                ]}
              />
            </Field>
          </div>
        ) : null}
      </Modal>

      {/* ---------------------------- CSV dialog ---------------------------- */}
      <Modal
        open={csvReport !== null}
        onOpenChange={(open) => !open && setCsvReport(null)}
        title={csvReport?.kind === 'contacts' ? 'Import contacts' : 'Import opportunities'}
        size="lg"
        footer={
          csvReport && csvReport.result.records.length > 0 ? (
            <>
              <Button variant="ghost" onClick={() => setCsvReport(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={busy === 'csv'}
                onClick={async () => {
                  if (!csvReport) return
                  setBusy('csv')
                  try {
                    const count = csvReport.result.records.length
                    if (csvReport.kind === 'contacts') {
                      for (const record of csvReport.result.records) await createContact(record)
                      setCsvReport(null)
                      toast.success(`Imported ${count} ${pluralize(count, 'contact')}`)
                    } else {
                      for (const record of csvReport.result.records) await createOpportunity(record)
                      setCsvReport(null)
                      toast.success(`Imported ${count} ${pluralize(count, 'opportunity', 'opportunities')}`)
                    }
                  } catch (error) {
                    toast.error('Import failed', error instanceof Error ? error.message : undefined)
                  } finally {
                    setBusy(null)
                  }
                }}
              >
                Import {csvReport.result.records.length}{' '}
                {csvReport.kind === 'contacts'
                  ? pluralize(csvReport.result.records.length, 'contact')
                  : pluralize(csvReport.result.records.length, 'opportunity', 'opportunities')}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setCsvReport(null)}>
              Close
            </Button>
          )
        }
      >
        {csvReport && (
          <div className="space-y-4">
            {csvReport.result.records.length === 0 ? (
              <div className="flex items-start gap-3 rounded-lg border border-critical/40 bg-critical-soft p-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden />
                <div>
                  <p className="text-base font-medium text-fg">Nothing could be imported</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {csvReport.result.issues.find((i) => i.severity === 'error')?.message ??
                      'No usable rows were found in this file.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-base text-fg">
                  <span className="font-semibold tabular-nums">{csvReport.result.records.length}</span> of{' '}
                  {csvReport.result.totalRows} rows are ready to import.
                </p>

                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[30rem] text-left text-sm">
                    <thead className="bg-subtle">
                      <tr>
                        {(csvReport.kind === 'contacts'
                          ? ['Name', 'Relationship', 'Company', 'Follow-up']
                          : ['Company', 'Role', 'Stage', 'Applied']
                        ).map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="px-3 py-1.5 text-2xs font-semibold uppercase text-faint"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvReport.kind === 'contacts'
                        ? csvReport.result.records.slice(0, 6).map((r, i) => (
                            <tr key={i} className="border-t border-line">
                              <td className="max-w-[10rem] truncate px-3 py-1.5 text-fg">{r.name}</td>
                              <td className="px-3 py-1.5 text-muted">
                                {RELATIONSHIP_META[r.relationship ?? 'other'].label}
                              </td>
                              <td className="max-w-[10rem] truncate px-3 py-1.5 text-muted">{r.company ?? '—'}</td>
                              <td className="px-3 py-1.5 tabular-nums text-muted">{r.nextFollowUpDate ?? '—'}</td>
                            </tr>
                          ))
                        : csvReport.result.records.slice(0, 6).map((r, i) => (
                            <tr key={i} className="border-t border-line">
                              <td className="max-w-[10rem] truncate px-3 py-1.5 text-fg">{r.company}</td>
                              <td className="max-w-[14rem] truncate px-3 py-1.5 text-muted">{r.role}</td>
                              <td className="px-3 py-1.5 text-muted">{STAGE_META[r.stage ?? 'saved'].label}</td>
                              <td className="px-3 py-1.5 tabular-nums text-muted">{r.dateApplied ?? '—'}</td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                  {csvReport.result.records.length > 6 && (
                    <p className="border-t border-line px-3 py-1.5 text-xs text-faint">
                      and {csvReport.result.records.length - 6} more
                    </p>
                  )}
                </div>
              </>
            )}

            {csvReport.result.ignoredColumns.length > 0 && (
              <p className="text-xs text-faint">
                Columns not recognised and skipped: {csvReport.result.ignoredColumns.join(', ')}
              </p>
            )}

            {csvReport.result.issues.length > 0 && (
              <div className="rounded-lg border border-line bg-subtle/60 p-3">
                <p className="text-sm font-medium text-fg">
                  {csvReport.result.issues.length} {pluralize(csvReport.result.issues.length, 'note')}
                </p>
                <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                  {csvReport.result.issues.slice(0, 40).map((issue, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed">
                      <Badge tone={issue.severity === 'error' ? 'critical' : 'caution'}>
                        {issue.row > 0 ? `Row ${issue.row}` : 'File'}
                      </Badge>
                      <span className="text-muted">{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>


      <ConfirmDialog
        open={confirmDemo}
        onOpenChange={setConfirmDemo}
        title="Load the demo workspace?"
        confirmLabel="Load demo data"
        destructive={!workspace.isEmpty}
        body={
          workspace.isEmpty ? (
            <p>Fifteen fictional opportunities and everything attached to them will be added.</p>
          ) : (
            <p>
              This replaces everything currently in this workspace, including your Master Profile. Export a
              backup first if you want to keep it.
            </p>
          )
        }
        onConfirm={async () => {
          await takeSnapshot('before-demo')
          await clearAllData()
          const { counts } = await (await import('@/lib/demo')).seedDemoWorkspace()
          toast.success('Demo workspace loaded', `${counts.opportunities} opportunities and ${counts.contacts} contacts.`)
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear this workspace?"
        destructive
        confirmLabel="Delete everything"
        typeToConfirm="DELETE"
        body={
          <>
            <p>
              All {workspace.opportunities.length} opportunities, {workspace.contacts.length} contacts,{' '}
              {workspace.interviews.length} interviews and {workspace.stories.length} stories will be removed
              from this browser.
            </p>
            <p>
              A restore point is saved first, so this can be rolled back from{' '}
              <span className="text-fg">Settings → Safety</span> — unless you delete those too.
            </p>
            <label className="flex items-start gap-2 rounded-md border border-line bg-subtle/60 px-2.5 py-2 text-sm">
              <input
                type="checkbox"
                checked={alsoDeleteSnapshots}
                onChange={(e) => setAlsoDeleteSnapshots(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[hsl(var(--critical))]"
              />
              <span className="text-fg">
                Also delete every restore point
                <span className="mt-0.5 block text-xs text-muted">
                  Choose this if you are clearing the workspace to remove the data from this device entirely.
                </span>
              </span>
            </label>
          </>
        }
        onConfirm={async () => {
          await takeSnapshot('before-clear')
          await clearAllData({ includeSnapshots: alsoDeleteSnapshots })
          toast.success(
            'Workspace cleared',
            alsoDeleteSnapshots
              ? 'Restore points were deleted too.'
              : 'A restore point was saved — you can roll this back from Settings → Safety.',
          )
        }}
      />
    </div>
  )
}

function DataCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-panel p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-muted [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
          {icon}
        </span>
        <h3 className="text-base font-medium text-fg">{title}</h3>
      </div>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-3">{action}</div>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn('text-lg font-semibold tabular-nums text-fg')}>{value}</dd>
      {sub && <p className="text-xs text-faint">{sub}</p>}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
