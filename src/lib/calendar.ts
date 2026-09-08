/**
 * iCalendar (RFC 5545) export for interviews.
 *
 * Generated locally and handed to the user as a file — no calendar account, no
 * network call. Importing it is their decision.
 */
import { INTERVIEW_TYPE_META, type Interview, type Opportunity } from './types'

function pad(n: number): string {
  return `${n}`.padStart(2, '0')
}

/** UTC basic format, e.g. 20260902T140000Z. */
function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/** Escapes the characters iCalendar treats as structural. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Folds long lines to 75 octets, as required by the spec. */
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest.length > 0) parts.push(` ${rest}`)
  return parts.join('\r\n')
}

export interface CalendarEventInput {
  interview: Interview
  opportunity: Opportunity | undefined
  /** Names to list in the description. */
  interviewerNames: string[]
}

function buildEvent({ interview, opportunity, interviewerNames }: CalendarEventInput): string[] {
  const start = new Date(interview.scheduledAt)
  if (Number.isNaN(start.getTime())) return []
  const end = new Date(start.getTime() + interview.durationMinutes * 60_000)

  const typeLabel = INTERVIEW_TYPE_META[interview.type].label
  const summary = opportunity
    ? `${typeLabel} interview — ${opportunity.company}`
    : `${typeLabel} interview`

  const description: string[] = []
  if (opportunity) description.push(`Role: ${opportunity.role}`)
  if (interviewerNames.length > 0) description.push(`With: ${interviewerNames.join(', ')}`)
  if (interview.interviewers) description.push(interview.interviewers)
  if (interview.questionsToAsk.length > 0) {
    description.push('', 'Questions to ask:', ...interview.questionsToAsk.map((q) => `- ${q}`))
  }
  if (interview.prepNotes) description.push('', interview.prepNotes)
  if (opportunity?.jobUrl) description.push('', opportunity.jobUrl)

  const location =
    interview.format === 'onsite'
      ? (opportunity?.location ?? 'On-site')
      : interview.format === 'phone'
        ? 'Phone'
        : interview.format === 'async'
          ? 'Async'
          : 'Video call'

  return [
    'BEGIN:VEVENT',
    `UID:${interview.id}@opportunity-os.local`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description.join('\n'))}`,
    `LOCATION:${escapeText(location)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
  ]
}

export function buildIcs(events: CalendarEventInput[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Opportunity OS//Interview Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap(buildEvent),
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}
