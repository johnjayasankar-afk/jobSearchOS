/**
 * What your own interviews have taught you.
 *
 * A tracker records that an interview happened. This turns the half hour
 * afterwards — while you can still remember what they asked — into the only
 * data in the app that is genuinely about you: which questions keep coming up,
 * which ones you struggle with, and which arrived with no story behind them.
 *
 * Everything here is counted from debriefs you wrote. Nothing is inferred, and
 * with two interviews behind you it says so rather than pretending a pattern.
 */
import { QUESTIONS, type InterviewQuestion } from './questions'
import type { Interview, Story, StoryTag } from './types'

export { DEBRIEF_WINDOW_DAYS, debriefIsDue } from './rehearsal'

/** Below this, counts are history rather than a pattern. */
export const MIN_INTERVIEWS_FOR_PATTERN = 4

/**
 * Lookup for questions that have already been asked.
 *
 * Deliberately wider than the bank in force: setting a question aside says it
 * will not come up again, not that it never did. Dropping it here would quietly
 * shrink a debrief you wrote, which is a record rather than a preference.
 */
function indexOf(bank: InterviewQuestion[]): Map<string, InterviewQuestion> {
  const index = new Map<string, InterviewQuestion>(QUESTIONS.map((q) => [q.id, q]))
  for (const q of bank) index.set(q.id, q)
  return index
}

export interface QuestionRecord {
  question: InterviewQuestion
  /** Interviews in which this was asked. */
  asked: number
  /** Of those, the ones you marked as a struggle. */
  struggled: number
}

export interface DebriefInsights {
  /** Interviews with a completed debrief. */
  debriefed: number
  /** Questions from the bank you have actually been asked, most first. */
  recorded: QuestionRecord[]
  /** Asked at least once and struggled every time. */
  weakest: QuestionRecord[]
  /** Questions you were asked that the bank does not carry. */
  offBank: Array<{ text: string; count: number; struggled: number }>
  /** True once there is enough history to read anything into the counts. */
  patternWorthReading: boolean
}

function interviewsWithDebrief(interviews: Interview[]): Interview[] {
  return interviews.filter((iv) => iv.debriefedAt && (iv.askedQuestions?.length ?? 0) > 0)
}

export function buildDebriefInsights(
  interviews: Interview[],
  bank: InterviewQuestion[] = QUESTIONS,
): DebriefInsights {
  const byId = indexOf(bank)
  const done = interviewsWithDebrief(interviews)

  const counts = new Map<string, { asked: number; struggled: number }>()
  const off = new Map<string, { text: string; count: number; struggled: number }>()

  for (const iv of done) {
    // One interview counts once per question however many times it was probed.
    const seen = new Set<string>()
    for (const entry of iv.askedQuestions ?? []) {
      if (entry.questionId && byId.has(entry.questionId)) {
        if (seen.has(entry.questionId)) continue
        seen.add(entry.questionId)
        const row = counts.get(entry.questionId) ?? { asked: 0, struggled: 0 }
        row.asked += 1
        if (entry.verdict === 'badly') row.struggled += 1
        counts.set(entry.questionId, row)
        continue
      }
      const text = entry.text?.trim()
      if (!text) continue
      const key = text.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const row = off.get(key) ?? { text, count: 0, struggled: 0 }
      row.count += 1
      if (entry.verdict === 'badly') row.struggled += 1
      off.set(key, row)
    }
  }

  const recorded: QuestionRecord[] = []
  for (const [id, row] of counts) {
    const question = byId.get(id)
    if (!question) continue
    recorded.push({ question, asked: row.asked, struggled: row.struggled })
  }
  recorded.sort(
    (a, b) => b.asked - a.asked || b.struggled - a.struggled || a.question.text.localeCompare(b.question.text),
  )

  return {
    debriefed: done.length,
    recorded,
    weakest: recorded.filter((r) => r.struggled > 0).sort((a, b) => b.struggled - a.struggled || b.asked - a.asked),
    offBank: [...off.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)),
    patternWorthReading: done.length >= MIN_INTERVIEWS_FOR_PATTERN,
  }
}

/** How often a single question has come up, for showing beside it. */
export function askedCount(insights: DebriefInsights, questionId: string): QuestionRecord | null {
  return insights.recorded.find((r) => r.question.id === questionId) ?? null
}

/* -------------------------------------------------------------------------- */
/*  Themes you were asked about but could not answer                           */
/* -------------------------------------------------------------------------- */

export interface ThemeGap {
  tag: StoryTag
  /** Interviews where a question on this theme came up. */
  asked: number
  struggled: number
  /** True when no finished story carries the theme. */
  unwritten: boolean
}

function isComplete(story: Story): boolean {
  return Boolean(
    story.situation?.trim() && story.task?.trim() && story.action?.trim() && story.result?.trim(),
  )
}

/**
 * The intersection that matters: themes real interviewers have raised with you,
 * ranked by how badly it went and whether you have anything written down.
 */
export function themeGaps(insights: DebriefInsights, stories: Story[]): ThemeGap[] {
  const byTheme = new Map<StoryTag, { asked: number; struggled: number }>()
  for (const record of insights.recorded) {
    const row = byTheme.get(record.question.theme) ?? { asked: 0, struggled: 0 }
    row.asked += record.asked
    row.struggled += record.struggled
    byTheme.set(record.question.theme, row)
  }

  const gaps: ThemeGap[] = []
  for (const [tag, row] of byTheme) {
    const unwritten = !stories.some((s) => s.tags.includes(tag) && isComplete(s))
    gaps.push({ tag, asked: row.asked, struggled: row.struggled, unwritten })
  }
  return gaps.sort(
    (a, b) =>
      Number(b.unwritten) - Number(a.unwritten) || b.struggled - a.struggled || b.asked - a.asked,
  )
}

/** Questions worth offering as a checklist for one interview's debrief. */
export function questionsForDebrief(
  interview: Pick<Interview, 'type'>,
  bank: InterviewQuestion[] = QUESTIONS,
): InterviewQuestion[] {
  const matching = bank.filter((q) => q.formats.includes(interview.type))
  // A format with nothing attributed to it should still offer the whole bank
  // rather than an empty list.
  return matching.length > 0 ? matching : bank
}
