/**
 * RFC 4180 CSV reading and writing, plus the opportunity column mapping used by
 * Settings → Data. The parser is strict about quoting but forgiving about
 * whitespace, header casing and column order, and it reports per-row problems
 * instead of failing the whole file.
 */
import {
  PRIORITIES,
  RELATIONSHIPS,
  RELATIONSHIP_META,
  STAGES,
  STAGE_META,
  WORK_ARRANGEMENTS,
  type Contact,
  type Opportunity,
  type Priority,
  type Relationship,
  type Stage,
  type WorkArrangement,
} from './types'
import type { NewContact, NewOpportunity } from './repo'
import { normalize, parseDateOnly, uniq } from './utils'

/* ------------------------------- writing ---------------------------------- */

function escapeCell(value: unknown): string {
  if (value === undefined || value === null) return ''
  const s = String(value)
  // Guard against spreadsheet formula injection on import elsewhere.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const row of rows) lines.push(row.map(escapeCell).join(','))
  return `${lines.join('\r\n')}\r\n`
}

/* ------------------------------- reading ---------------------------------- */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  // Strip a UTF-8 BOM, which Excel adds.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0))
}

/* --------------------------- opportunity mapping -------------------------- */

export const OPPORTUNITY_CSV_HEADERS = [
  'Company',
  'Role',
  'Stage',
  'Priority',
  'Fit Score',
  'Location',
  'Work Arrangement',
  'Salary Min',
  'Salary Max',
  'Currency',
  'Source',
  'Tags',
  'Next Action',
  'Next Action Date',
  'Date Discovered',
  'Date Applied',
  'Deadline',
  'Job URL',
  'Why Interested',
  'Notes',
  'Archived',
  'Created At',
  'Updated At',
] as const

export function opportunityToRow(o: Opportunity, fitScore: number | null): Array<unknown> {
  return [
    o.company,
    o.role,
    STAGE_META[o.stage].label,
    o.priority,
    fitScore ?? '',
    o.location ?? '',
    o.workArrangement === 'unknown' ? '' : o.workArrangement,
    o.salaryMin ?? '',
    o.salaryMax ?? '',
    o.currency,
    o.source ?? '',
    o.tags.join('; '),
    o.nextAction ?? '',
    o.nextActionDate ?? '',
    o.dateDiscovered,
    o.dateApplied ?? '',
    o.deadline ?? '',
    o.jobUrl ?? '',
    o.whyInterested ?? '',
    o.notes ?? '',
    o.archivedAt ? 'yes' : '',
    o.createdAt,
    o.updatedAt,
  ]
}

export interface CsvIssue {
  row: number
  message: string
  severity: 'error' | 'warning'
}

export interface CsvImportResult {
  records: NewOpportunity[]
  issues: CsvIssue[]
  /** Headers that were present but not understood. */
  ignoredColumns: string[]
  totalRows: number
}

const HEADER_ALIASES: Record<string, string> = {
  company: 'company',
  employer: 'company',
  organization: 'company',
  'company name': 'company',
  role: 'role',
  title: 'role',
  position: 'role',
  'job title': 'role',
  stage: 'stage',
  status: 'stage',
  priority: 'priority',
  location: 'location',
  city: 'location',
  'work arrangement': 'arrangement',
  arrangement: 'arrangement',
  remote: 'arrangement',
  'salary min': 'salaryMin',
  'min salary': 'salaryMin',
  'compensation min': 'salaryMin',
  'salary max': 'salaryMax',
  'max salary': 'salaryMax',
  'compensation max': 'salaryMax',
  salary: 'salaryMin',
  currency: 'currency',
  source: 'source',
  'where found': 'source',
  tags: 'tags',
  labels: 'tags',
  'next action': 'nextAction',
  'next step': 'nextAction',
  'next action date': 'nextActionDate',
  'next action due': 'nextActionDate',
  'date discovered': 'dateDiscovered',
  'discovered': 'dateDiscovered',
  'date added': 'dateDiscovered',
  'date applied': 'dateApplied',
  applied: 'dateApplied',
  'application date': 'dateApplied',
  deadline: 'deadline',
  'job url': 'jobUrl',
  url: 'jobUrl',
  link: 'jobUrl',
  'posting url': 'jobUrl',
  'why interested': 'whyInterested',
  notes: 'notes',
  note: 'notes',
  comments: 'notes',
  archived: 'archived',
  'fit score': 'ignore',
  'created at': 'ignore',
  'updated at': 'ignore',
}

const STAGE_LOOKUP = new Map<string, Stage>()
for (const s of STAGES) {
  STAGE_LOOKUP.set(s, s)
  STAGE_LOOKUP.set(normalize(STAGE_META[s].label), s)
  STAGE_LOOKUP.set(normalize(STAGE_META[s].label).replace(/[^a-z]/g, ''), s)
}
STAGE_LOOKUP.set('screen', 'recruiter_screen')
STAGE_LOOKUP.set('phone screen', 'recruiter_screen')
STAGE_LOOKUP.set('interviewing', 'hiring_manager')
STAGE_LOOKUP.set('interview', 'hiring_manager')
STAGE_LOOKUP.set('wishlist', 'saved')
STAGE_LOOKUP.set('bookmarked', 'saved')
STAGE_LOOKUP.set('in progress', 'applying')
STAGE_LOOKUP.set('no response', 'applied')
STAGE_LOOKUP.set('declined', 'withdrawn')
STAGE_LOOKUP.set('closed', 'rejected')

function parseNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9.k]/gi, '')
  if (!cleaned) return undefined
  const k = /^(\d+(?:\.\d+)?)k$/i.exec(cleaned)
  const n = k?.[1] ? Number(k[1]) * 1000 : Number(cleaned)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}

/** Accepts ISO, US and European date shapes; returns `YYYY-MM-DD` or undefined. */
export function parseFlexibleDate(raw: string): string | undefined {
  const value = raw.trim()
  if (!value) return undefined
  if (parseDateOnly(value)) return value
  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(value)
  if (slash) {
    const [, a, b, c] = slash
    const year = Number(c) < 100 ? 2000 + Number(c) : Number(c)
    // Ambiguous d/m vs m/d: values above 12 disambiguate, else assume m/d.
    const first = Number(a)
    const second = Number(b)
    const month = first > 12 ? second : first
    const day = first > 12 ? first : second
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`
    }
    return undefined
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return `${parsed.getFullYear()}-${`${parsed.getMonth() + 1}`.padStart(2, '0')}-${`${parsed.getDate()}`.padStart(2, '0')}`
}

export function importOpportunitiesCsv(text: string): CsvImportResult {
  const rows = parseCsv(text)
  const issues: CsvIssue[] = []
  if (rows.length === 0) {
    return { records: [], issues: [{ row: 0, message: 'The file is empty.', severity: 'error' }], ignoredColumns: [], totalRows: 0 }
  }

  const headerRow = rows[0] ?? []
  const mapping: Array<string | null> = []
  const ignored: string[] = []
  for (const header of headerRow) {
    const key = HEADER_ALIASES[normalize(header)]
    if (!key || key === 'ignore') {
      if (header.trim()) ignored.push(header.trim())
      mapping.push(null)
    } else {
      mapping.push(key)
    }
  }

  if (!mapping.includes('company') || !mapping.includes('role')) {
    return {
      records: [],
      issues: [
        {
          row: 1,
          message: 'The header row must include a "Company" column and a "Role" column.',
          severity: 'error',
        },
      ],
      ignoredColumns: ignored,
      totalRows: rows.length - 1,
    }
  }

  const records: NewOpportunity[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? []
    const get = (key: string): string => {
      const idx = mapping.indexOf(key)
      return idx === -1 ? '' : (cells[idx] ?? '').trim()
    }
    const rowNumber = r + 1

    const company = get('company')
    const role = get('role')
    if (!company && !role) continue
    if (!company || !role) {
      issues.push({ row: rowNumber, message: `Skipped — ${!company ? 'company' : 'role'} is empty.`, severity: 'error' })
      continue
    }

    const record: NewOpportunity = { company, role }

    const stageRaw = get('stage')
    if (stageRaw) {
      const stage = STAGE_LOOKUP.get(normalize(stageRaw))
      if (stage) record.stage = stage
      else issues.push({ row: rowNumber, message: `Unknown stage "${stageRaw}" — imported as Saved.`, severity: 'warning' })
    }

    const priorityRaw = normalize(get('priority'))
    if (priorityRaw) {
      const priority = PRIORITIES.find((p) => p === priorityRaw || priorityRaw.startsWith(p[0] ?? ''))
      if (priority) record.priority = priority as Priority
      else issues.push({ row: rowNumber, message: `Unknown priority "${priorityRaw}" — imported as Medium.`, severity: 'warning' })
    }

    const arrangementRaw = normalize(get('arrangement'))
    if (arrangementRaw) {
      const found = WORK_ARRANGEMENTS.find((a) => arrangementRaw.includes(a))
      record.workArrangement = (found ?? (/(yes|true)/.test(arrangementRaw) ? 'remote' : 'unknown')) as WorkArrangement
    }

    const location = get('location')
    if (location) record.location = location
    const source = get('source')
    if (source) record.source = source
    const currency = get('currency').toUpperCase()
    if (currency && /^[A-Z]{3}$/.test(currency)) record.currency = currency

    const min = parseNumber(get('salaryMin'))
    const max = parseNumber(get('salaryMax'))
    if (min) record.salaryMin = min
    if (max) record.salaryMax = max
    if (min && max && min > max) {
      record.salaryMin = max
      record.salaryMax = min
      issues.push({ row: rowNumber, message: 'Salary min was greater than max — the values were swapped.', severity: 'warning' })
    }

    const tags = get('tags')
    if (tags) record.tags = uniq(tags.split(/[;,|]/).map((t) => t.trim()).filter(Boolean))

    const nextAction = get('nextAction')
    if (nextAction) record.nextAction = nextAction

    for (const [field, key] of [
      ['nextActionDate', 'nextActionDate'],
      ['dateDiscovered', 'dateDiscovered'],
      ['dateApplied', 'dateApplied'],
      ['deadline', 'deadline'],
    ] as const) {
      const raw = get(key)
      if (!raw) continue
      const parsed = parseFlexibleDate(raw)
      if (parsed) (record as Record<string, unknown>)[field] = parsed
      else issues.push({ row: rowNumber, message: `Could not read the date "${raw}" in ${key}.`, severity: 'warning' })
    }

    const url = get('jobUrl')
    if (url) record.jobUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`
    const why = get('whyInterested')
    if (why) record.whyInterested = why
    const notes = get('notes')
    if (notes) record.notes = notes
    if (/^(yes|true|1)$/i.test(get('archived'))) record.archivedAt = new Date().toISOString()

    records.push(record)
  }

  if (records.length === 0 && issues.every((i) => i.severity === 'warning')) {
    issues.push({ row: 0, message: 'No importable rows were found.', severity: 'error' })
  }

  return { records, issues, ignoredColumns: ignored, totalRows: rows.length - 1 }
}

/* ----------------------------- contact mapping ---------------------------- */

export const CONTACT_CSV_HEADERS = [
  'Name',
  'Relationship',
  'Company',
  'Title',
  'Email',
  'Phone',
  'LinkedIn',
  'Last Contact',
  'Next Follow-up',
  'Tags',
  'Notes',
] as const

export function contactToRow(c: Contact): Array<unknown> {
  return [
    c.name,
    RELATIONSHIP_META[c.relationship].label,
    c.company ?? '',
    c.title ?? '',
    c.email ?? '',
    c.phone ?? '',
    c.linkedinUrl ?? '',
    c.lastContactDate ?? '',
    c.nextFollowUpDate ?? '',
    c.tags.join('; '),
    c.notes ?? '',
  ]
}

const CONTACT_HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  'full name': 'name',
  contact: 'name',
  'first name': 'firstName',
  'last name': 'lastName',
  relationship: 'relationship',
  type: 'relationship',
  company: 'company',
  organization: 'company',
  employer: 'company',
  title: 'title',
  'job title': 'title',
  role: 'title',
  position: 'title',
  email: 'email',
  'email address': 'email',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  linkedin: 'linkedinUrl',
  'linkedin url': 'linkedinUrl',
  profile: 'linkedinUrl',
  'last contact': 'lastContactDate',
  'last contacted': 'lastContactDate',
  'next follow-up': 'nextFollowUpDate',
  'next follow up': 'nextFollowUpDate',
  'follow-up': 'nextFollowUpDate',
  tags: 'tags',
  labels: 'tags',
  notes: 'notes',
  note: 'notes',
}

const RELATIONSHIP_LOOKUP = new Map<string, Relationship>()
for (const r of RELATIONSHIPS) {
  RELATIONSHIP_LOOKUP.set(r, r)
  RELATIONSHIP_LOOKUP.set(normalize(RELATIONSHIP_META[r].label), r)
}
RELATIONSHIP_LOOKUP.set('hiring manager', 'hiring_manager')
RELATIONSHIP_LOOKUP.set('manager', 'hiring_manager')
RELATIONSHIP_LOOKUP.set('talent', 'recruiter')
RELATIONSHIP_LOOKUP.set('talent partner', 'recruiter')
RELATIONSHIP_LOOKUP.set('colleague', 'employee')
RELATIONSHIP_LOOKUP.set('classmate', 'alumni')

export interface ContactCsvImportResult {
  records: NewContact[]
  issues: CsvIssue[]
  ignoredColumns: string[]
  totalRows: number
}

/**
 * Reads a contact export from a spreadsheet or another CRM. Only a name is
 * required — everything else is matched by column name where it can be.
 */
export function importContactsCsv(text: string): ContactCsvImportResult {
  const rows = parseCsv(text)
  const issues: CsvIssue[] = []
  if (rows.length === 0) {
    return { records: [], issues: [{ row: 0, message: 'The file is empty.', severity: 'error' }], ignoredColumns: [], totalRows: 0 }
  }

  const headerRow = rows[0] ?? []
  const mapping: Array<string | null> = []
  const ignored: string[] = []
  for (const header of headerRow) {
    const key = CONTACT_HEADER_ALIASES[normalize(header)]
    if (!key) {
      if (header.trim()) ignored.push(header.trim())
      mapping.push(null)
    } else {
      mapping.push(key)
    }
  }

  const hasName = mapping.includes('name')
  const hasSplitName = mapping.includes('firstName') || mapping.includes('lastName')
  if (!hasName && !hasSplitName) {
    return {
      records: [],
      issues: [
        {
          row: 1,
          message: 'The header row must include a "Name" column, or "First Name" and "Last Name".',
          severity: 'error',
        },
      ],
      ignoredColumns: ignored,
      totalRows: rows.length - 1,
    }
  }

  const records: NewContact[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? []
    const get = (key: string): string => {
      const idx = mapping.indexOf(key)
      return idx === -1 ? '' : (cells[idx] ?? '').trim()
    }
    const rowNumber = r + 1

    const name = get('name') || [get('firstName'), get('lastName')].filter(Boolean).join(' ').trim()
    if (!name) {
      if (cells.some((c) => c.trim())) {
        issues.push({ row: rowNumber, message: 'Skipped — no name in this row.', severity: 'error' })
      }
      continue
    }

    const record: NewContact = { name }

    const relationshipRaw = normalize(get('relationship'))
    if (relationshipRaw) {
      const relationship = RELATIONSHIP_LOOKUP.get(relationshipRaw)
      if (relationship) record.relationship = relationship
      else {
        issues.push({
          row: rowNumber,
          message: `Unknown relationship "${get('relationship')}" — imported as Other.`,
          severity: 'warning',
        })
      }
    }

    const company = get('company')
    if (company) record.company = company
    const title = get('title')
    if (title) record.title = title

    const email = get('email')
    if (email) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) record.email = email
      else issues.push({ row: rowNumber, message: `"${email}" is not a valid email address — left blank.`, severity: 'warning' })
    }
    const phone = get('phone')
    if (phone) record.phone = phone
    const linkedin = get('linkedinUrl')
    if (linkedin) record.linkedinUrl = /^https?:\/\//i.test(linkedin) ? linkedin : `https://${linkedin}`

    for (const key of ['lastContactDate', 'nextFollowUpDate'] as const) {
      const raw = get(key)
      if (!raw) continue
      const parsed = parseFlexibleDate(raw)
      if (parsed) record[key] = parsed
      else issues.push({ row: rowNumber, message: `Could not read the date "${raw}".`, severity: 'warning' })
    }

    const tags = get('tags')
    if (tags) record.tags = uniq(tags.split(/[;,|]/).map((t) => t.trim()).filter(Boolean))
    const notes = get('notes')
    if (notes) record.notes = notes

    records.push(record)
  }

  if (records.length === 0 && !issues.some((i) => i.severity === 'error')) {
    issues.push({ row: 0, message: 'No importable rows were found.', severity: 'error' })
  }

  return { records, issues, ignoredColumns: ignored, totalRows: rows.length - 1 }
}
