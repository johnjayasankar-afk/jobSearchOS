/**
 * The question bank, and what your stories can actually answer.
 *
 * A story bank is worth nothing on its own. The question that matters is
 * narrower: if they ask about a failure, is there something in here you could
 * tell? This file holds a fixed list of questions that genuinely recur in
 * senior interviews, and works out which of them your stories cover.
 *
 * The matching is tag overlap and nothing else — no inference, no model. A
 * question is answerable when you have a *finished* story carrying one of its
 * themes; a half-written story is reported as exactly that, because a story
 * with no result is not an answer.
 */
import {
  STORY_TAGS,
  type CustomQuestion,
  type InterviewType,
  type Story,
  type StoryTag,
} from './types'
import { storyCompleteness } from './stories'
import { sharpnessOf, type Sharpness } from './rehearsal'

export interface InterviewQuestion {
  /** Stable slug; safe to persist. */
  id: string
  text: string
  /** The theme a story needs to answer this. */
  theme: StoryTag
  /** Other themes that would also serve. */
  also?: StoryTag[]
  /** Interview formats where this tends to come up. */
  formats: InterviewType[]
  /** What the interviewer is actually testing. Editorial, not generated. */
  listeningFor: string
  /** True for a question the user wrote. */
  custom?: boolean
}

/* -------------------------------------------------------------------------- */
/*  The bank                                                                   */
/* -------------------------------------------------------------------------- */

export const QUESTIONS: InterviewQuestion[] = [
  /* -- Leadership -- */
  {
    id: 'lead-uncertainty',
    text: 'Tell me about a time you led a team through a period of real uncertainty.',
    theme: 'Leadership',
    also: ['Strategy'],
    formats: ['hiring_manager', 'behavioral', 'panel', 'founder'],
    listeningFor: 'Whether you gave people a decision to work from, or passed the ambiguity down the org.',
  },
  {
    id: 'lead-bar',
    text: "Describe a time you had to raise the bar on a team's work.",
    theme: 'Leadership',
    also: ['Execution'],
    formats: ['hiring_manager', 'behavioral'],
    listeningFor: 'Whether you can name the specific gap, rather than describing people as "not strong".',
  },
  {
    id: 'lead-developed',
    text: 'Tell me about someone you developed. What did you actually do?',
    theme: 'Leadership',
    formats: ['hiring_manager', 'behavioral', 'panel'],
    listeningFor: 'Concrete intervention and evidence it worked — not a warm summary of their promotion.',
  },
  {
    id: 'lead-without-authority',
    text: "When have you led people who didn't report to you?",
    theme: 'Leadership',
    also: ['Stakeholders'],
    formats: ['hiring_manager', 'behavioral', 'panel'],
    listeningFor: 'Whether influence came from credibility and clarity, or from escalation.',
  },

  /* -- Conflict -- */
  {
    id: 'conflict-manager',
    text: 'Tell me about a time you disagreed with your manager.',
    theme: 'Conflict',
    also: ['Stakeholders'],
    formats: ['hiring_manager', 'behavioral', 'panel'],
    listeningFor: 'That you can disagree on substance, and that you committed once the call was made.',
  },
  {
    id: 'conflict-teams',
    text: 'Describe a conflict between two teams that you had to resolve.',
    theme: 'Conflict',
    also: ['Stakeholders', 'Leadership'],
    formats: ['hiring_manager', 'behavioral', 'panel'],
    listeningFor: 'Whether you found the underlying incentive clash or just brokered a truce.',
  },
  {
    id: 'conflict-feedback',
    text: 'What is the hardest piece of feedback you have had to give?',
    theme: 'Conflict',
    also: ['Leadership'],
    formats: ['hiring_manager', 'behavioral'],
    listeningFor: 'Directness and timing. Most people admit they waited too long; the good answers say why.',
  },
  {
    id: 'conflict-no',
    text: 'Tell me about a time you said no to someone significantly more senior.',
    theme: 'Conflict',
    also: ['Stakeholders', 'Strategy'],
    formats: ['hiring_manager', 'behavioral', 'founder'],
    listeningFor: 'What you offered instead. A flat no is rarely the story they want.',
  },

  /* -- Failure -- */
  {
    id: 'fail-project',
    text: 'Tell me about a project that failed.',
    theme: 'Failure',
    formats: ['hiring_manager', 'behavioral', 'panel'],
    listeningFor: 'Ownership of a decision you got wrong, not of the circumstances around it.',
  },
  {
    id: 'fail-differently',
    text: 'What is a decision you would make differently today?',
    theme: 'Failure',
    also: ['Strategy'],
    formats: ['hiring_manager', 'behavioral', 'founder'],
    listeningFor: 'Whether the lesson changed your later behaviour, with an example that it did.',
  },
  {
    id: 'fail-metric',
    text: 'Tell me about something you shipped that hurt a metric.',
    theme: 'Failure',
    also: ['Analytics', 'Growth'],
    formats: ['product_execution', 'behavioral', 'case'],
    listeningFor: 'How fast you noticed, and what you did in the first 48 hours.',
  },
  {
    id: 'fail-wrong-about-users',
    text: 'When were you wrong about what users needed?',
    theme: 'Failure',
    also: ['0→1'],
    formats: ['product_sense', 'behavioral', 'founder'],
    listeningFor: 'Evidence you sought disconfirmation, rather than being corrected by the market.',
  },

  /* -- 0→1 -- */
  {
    id: 'zero-one-launch',
    text: 'Walk me through something you took from nothing to launched.',
    theme: '0→1',
    also: ['Execution'],
    formats: ['product_sense', 'founder', 'hiring_manager', 'panel'],
    listeningFor: 'The sequence of bets and what each one cost, not a feature list.',
  },
  {
    id: 'zero-one-first-users',
    text: 'How did you find the first users for something new?',
    theme: '0→1',
    also: ['Growth'],
    formats: ['product_sense', 'founder'],
    listeningFor: 'Specific, unglamorous acquisition. Vague "we did outreach" answers land badly.',
  },
  {
    id: 'zero-one-killed',
    text: 'Tell me about an idea you killed before building it.',
    theme: '0→1',
    also: ['Strategy'],
    formats: ['product_sense', 'founder', 'case'],
    listeningFor: 'The cheapest test you could have run, and whether you actually ran it.',
  },

  /* -- Growth -- */
  {
    id: 'growth-moved-metric',
    text: 'Tell me about a time you moved a metric that mattered.',
    theme: 'Growth',
    also: ['Analytics', 'Execution'],
    formats: ['product_execution', 'case', 'hiring_manager'],
    listeningFor: 'Baseline, size of the change, and how you know it was you.',
  },
  {
    id: 'growth-failed-experiment',
    text: 'Describe a growth experiment that did not work.',
    theme: 'Growth',
    also: ['Failure', 'Analytics'],
    formats: ['product_execution', 'case'],
    listeningFor: 'What the null result taught you, and whether you stopped or iterated.',
  },
  {
    id: 'growth-lever',
    text: 'When have you found a lever nobody else had noticed?',
    theme: 'Growth',
    also: ['Analytics', 'Strategy'],
    formats: ['product_execution', 'case', 'founder'],
    listeningFor: 'Where the insight came from. "I looked at the funnel" is not an insight.',
  },

  /* -- Analytics -- */
  {
    id: 'analytics-against-data',
    text: 'Tell me about a decision you made against the data.',
    theme: 'Analytics',
    also: ['Strategy'],
    formats: ['product_execution', 'case', 'hiring_manager'],
    listeningFor: 'That you knew what the data could and could not tell you, and said so at the time.',
  },
  {
    id: 'analytics-ambiguous',
    text: 'Describe a time the data was ambiguous. How did you decide?',
    theme: 'Analytics',
    formats: ['product_execution', 'case', 'panel'],
    listeningFor: 'A decision rule set in advance, rather than a story that rationalises the outcome.',
  },
  {
    id: 'analytics-defined-metric',
    text: 'Walk me through a metric you defined from scratch.',
    theme: 'Analytics',
    also: ['Strategy'],
    formats: ['product_execution', 'case', 'technical'],
    listeningFor: 'What it deliberately excluded, and how it could be gamed.',
  },

  /* -- Technical -- */
  {
    id: 'tech-tradeoff',
    text: 'Describe a technical trade-off you made with engineering.',
    theme: 'Technical',
    also: ['Execution'],
    formats: ['technical', 'hiring_manager', 'panel'],
    listeningFor: 'That you understood the trade well enough to argue either side of it.',
  },
  {
    id: 'tech-deep',
    text: 'Tell me about a time you had to understand a system deeply to make a call.',
    theme: 'Technical',
    formats: ['technical', 'product_execution'],
    listeningFor: 'How far you actually went. Interviewers probe here for bluffing.',
  },
  {
    id: 'tech-debt',
    text: 'How have you handled significant technical debt?',
    theme: 'Technical',
    also: ['Strategy', 'Stakeholders'],
    formats: ['technical', 'hiring_manager'],
    listeningFor: 'How you funded it — the answer is usually a negotiation, not a decision.',
  },

  /* -- AI -- */
  {
    id: 'ai-wrong-output',
    text: "Tell me about shipping something where the system's output could be wrong.",
    theme: 'AI',
    also: ['Technical'],
    formats: ['technical', 'product_sense', 'panel'],
    listeningFor: 'What you did about the failure mode in the product, not in the model.',
  },
  {
    id: 'ai-quality',
    text: 'How have you evaluated quality where there is no single right answer?',
    theme: 'AI',
    also: ['Analytics', 'Technical'],
    formats: ['technical', 'case'],
    listeningFor: 'A concrete evaluation you built, and its known blind spots.',
  },

  /* -- Strategy -- */
  {
    id: 'strategy-changed-mind',
    text: 'Tell me about a strategy you changed your mind about.',
    theme: 'Strategy',
    also: ['Failure'],
    formats: ['founder', 'hiring_manager', 'case', 'panel'],
    listeningFor: 'What evidence moved you, and how long it took you to act on it.',
  },
  {
    id: 'strategy-not-do',
    text: 'How did you decide what not to do?',
    theme: 'Strategy',
    also: ['Execution'],
    formats: ['product_sense', 'case', 'hiring_manager', 'founder'],
    listeningFor: 'A real thing you gave up that hurt, not a strawman you were never going to build.',
  },
  {
    id: 'strategy-long-loop',
    text: 'Describe a call you made with a very long feedback loop.',
    theme: 'Strategy',
    formats: ['founder', 'case', 'panel'],
    listeningFor: 'The leading indicators you chose to watch while waiting.',
  },

  /* -- Execution -- */
  {
    id: 'exec-complex',
    text: 'Tell me about the most complex thing you have shipped.',
    theme: 'Execution',
    also: ['Technical', 'Stakeholders'],
    formats: ['hiring_manager', 'product_execution', 'panel', 'recruiter'],
    listeningFor: 'Where the complexity actually lived — usually coordination, not the build.',
  },
  {
    id: 'exec-cut-scope',
    text: 'Describe a time you had to cut scope late.',
    theme: 'Execution',
    also: ['Stakeholders'],
    formats: ['product_execution', 'hiring_manager', 'behavioral'],
    listeningFor: 'How you chose, and how you told the people who lost their piece.',
  },
  {
    id: 'exec-recovery',
    text: 'When did you have to recover a project that was slipping?',
    theme: 'Execution',
    also: ['Leadership'],
    formats: ['product_execution', 'hiring_manager', 'behavioral'],
    listeningFor: 'The diagnosis. Adding people and cutting scope are treatments, not causes.',
  },

  /* -- Stakeholders -- */
  {
    id: 'stake-influence',
    text: 'Tell me about influencing someone who did not report to you.',
    theme: 'Stakeholders',
    also: ['Leadership'],
    formats: ['hiring_manager', 'behavioral', 'panel'],
    listeningFor: 'That you understood what they were measured on before you asked for anything.',
  },
  {
    id: 'stake-unhappy-exec',
    text: 'Describe a time you had to manage an unhappy executive.',
    theme: 'Stakeholders',
    also: ['Conflict'],
    formats: ['hiring_manager', 'behavioral', 'panel'],
    listeningFor: 'Whether you brought a decision or brought the problem back up the chain.',
  },
  {
    id: 'stake-skeptical',
    text: 'How have you built trust with a skeptical partner team?',
    theme: 'Stakeholders',
    formats: ['hiring_manager', 'behavioral'],
    listeningFor: 'Something you did first, unasked, that cost you something.',
  },
]

/* -------------------------------------------------------------------------- */
/*  Resolving the bank                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The bank this workspace actually uses: the built-ins, minus anything set
 * aside as not applying, plus the user's own questions.
 *
 * Everything downstream — coverage, drills, the debrief checklist — takes the
 * result rather than importing `QUESTIONS`, so a question someone wrote counts
 * exactly as much as one that shipped.
 */
export function resolveBank(
  custom: CustomQuestion[] = [],
  hidden: readonly string[] = [],
): InterviewQuestion[] {
  const skip = new Set(hidden)
  const mine: InterviewQuestion[] = custom.map((q) => ({
    id: q.id,
    text: q.text,
    theme: q.theme,
    also: q.also,
    formats: q.formats,
    listeningFor: q.listeningFor?.trim() || 'Your own question.',
    custom: true,
  }))
  return [...QUESTIONS.filter((q) => !skip.has(q.id)), ...mine]
}

/* -------------------------------------------------------------------------- */
/*  Coverage                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Depth, not just presence. A theme with exactly one finished story is not
 * covered in any useful sense: interviewers routinely ask two questions on the
 * same theme, and the second one is where people repeat themselves.
 */
export const DEPTH_FOR_READY = 2

export type CoverageState = 'ready' | 'thin' | 'uncovered'

export interface ThemeCoverage {
  tag: StoryTag
  state: CoverageState
  /** Stories with this theme that are finished. */
  ready: Story[]
  /** Stories with this theme still missing a STAR section. */
  drafts: Story[]
  questions: InterviewQuestion[]
}

export interface Coverage {
  themes: ThemeCoverage[]
  readyCount: number
  thinCount: number
  uncoveredCount: number
  /** Questions with no finished story behind them. */
  unanswerable: InterviewQuestion[]
  /** Themes resting on exactly one finished story. */
  singleStory: ThemeCoverage[]
}

function isComplete(story: Story): boolean {
  return storyCompleteness(story).missing.length === 0
}

/** Stories that could answer a question: theme tag, or one of its alternates. */
export function storiesForQuestion(question: InterviewQuestion, stories: Story[]): Story[] {
  const themes = new Set<string>([question.theme, ...(question.also ?? [])])
  return stories.filter((story) => story.tags.some((tag) => themes.has(tag)))
}

export function buildCoverage(stories: Story[], bank: InterviewQuestion[] = QUESTIONS): Coverage {
  const themes: ThemeCoverage[] = STORY_TAGS.map((tag) => {
    const withTag = stories.filter((story) => story.tags.includes(tag))
    const ready = withTag.filter(isComplete)
    const drafts = withTag.filter((story) => !isComplete(story))
    return {
      tag,
      state:
        ready.length >= DEPTH_FOR_READY
          ? 'ready'
          : ready.length > 0 || drafts.length > 0
            ? 'thin'
            : 'uncovered',
      ready,
      drafts,
      questions: bank.filter((q) => q.theme === tag),
    }
  })

  const unanswerable = bank.filter(
    (question) => !storiesForQuestion(question, stories).some(isComplete),
  )

  return {
    themes,
    readyCount: themes.filter((t) => t.state === 'ready').length,
    thinCount: themes.filter((t) => t.state === 'thin').length,
    uncoveredCount: themes.filter((t) => t.state === 'uncovered').length,
    unanswerable,
    singleStory: themes.filter((t) => t.ready.length === 1),
  }
}

/* -------------------------------------------------------------------------- */
/*  Building a practice set                                                    */
/* -------------------------------------------------------------------------- */

export interface DrillItem {
  question: InterviewQuestion
  /** The story you intend to tell, if you have one ready. */
  story: Story | null
  /** Other finished stories that would also serve. */
  alternates: Story[]
}

/**
 * Picks the questions worth practising for a given format, pairing each with
 * the story you are least sharp on — practice should land where it is needed,
 * not on the answer you have already given four times.
 */
export function buildDrill(
  stories: Story[],
  options: {
    formats?: InterviewType[]
    themes?: StoryTag[]
    limit?: number
    now?: Date
    /**
     * Question ids you have actually struggled with in an interview. These come
     * first: a real interviewer finding the hole in an answer is better evidence
     * than any self-assessment made at a desk.
     */
    struggled?: Iterable<string>
    /** The workspace's resolved bank; defaults to the built-ins alone. */
    bank?: InterviewQuestion[]
  } = {},
): DrillItem[] {
  const { formats, themes, limit = 8, now = new Date(), bank = QUESTIONS } = options
  const struggled = new Set(options.struggled ?? [])

  const rank: Record<Sharpness, number> = { shaky: 0, untested: 1, fading: 2, sharp: 3 }
  const pool = bank.filter((question) => {
    if (formats && formats.length > 0 && !question.formats.some((f) => formats.includes(f))) return false
    if (themes && themes.length > 0) {
      const qThemes = [question.theme, ...(question.also ?? [])]
      if (!qThemes.some((t) => themes.includes(t))) return false
    }
    return true
  })

  const items: DrillItem[] = pool.map((question) => {
    const candidates = storiesForQuestion(question, stories)
      .filter(isComplete)
      .sort((a, b) => {
        const byNeed = rank[sharpnessOf(a, now)] - rank[sharpnessOf(b, now)]
        if (byNeed !== 0) return byNeed
        return a.useCount - b.useCount || a.title.localeCompare(b.title)
      })
    const [story, ...alternates] = candidates
    return { question, story: story ?? null, alternates }
  })

  // Questions you can answer come first — a drill is practice, not an audit —
  // and within those, the ones you are least sure of.
  return items
    .sort((a, b) => {
      const byStruggle = Number(struggled.has(b.question.id)) - Number(struggled.has(a.question.id))
      if (byStruggle !== 0) return byStruggle
      if (Boolean(a.story) !== Boolean(b.story)) return a.story ? -1 : 1
      if (!a.story || !b.story) return a.question.text.localeCompare(b.question.text)
      const byNeed = rank[sharpnessOf(a.story, now)] - rank[sharpnessOf(b.story, now)]
      return byNeed !== 0 ? byNeed : a.question.text.localeCompare(b.question.text)
    })
    .slice(0, limit)
}
