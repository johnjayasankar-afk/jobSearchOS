/**
 * Story suggestions for interview prep.
 *
 * Matching is local tag and keyword overlap. Every suggestion carries the
 * reasons it surfaced, so the user can judge it rather than trust it.
 */
import { INTERVIEW_TYPE_META, type Interview, type Opportunity, type Story } from './types'
import { matchesTerm } from './parse'
import { normalize, uniq } from './utils'

export interface StorySuggestion {
  story: Story
  score: number
  reasons: string[]
}

export function suggestStories(
  interview: Pick<Interview, 'type' | 'storyIds'>,
  opportunity: Pick<Opportunity, 'role' | 'company' | 'jobDescription' | 'tags'> | undefined,
  stories: Story[],
  limit = 5,
): StorySuggestion[] {
  const formatTags = INTERVIEW_TYPE_META[interview.type].storyTags
  const roleHaystack = normalize(
    [opportunity?.role ?? '', opportunity?.jobDescription ?? '', opportunity?.tags.join(' ') ?? ''].join(' '),
  )
  const opportunityTags = (opportunity?.tags ?? []).map(normalize)

  const suggestions: StorySuggestion[] = []

  for (const story of stories) {
    if (interview.storyIds.includes(story.id)) continue
    let score = 0
    const reasons: string[] = []

    const tagHits = story.tags.filter((tag) => formatTags.includes(tag))
    if (tagHits.length > 0) {
      score += tagHits.length * 3
      reasons.push(
        `${tagHits.join(', ')} ${tagHits.length === 1 ? 'suits' : 'suit'} ${INTERVIEW_TYPE_META[interview.type].label.toLowerCase()} interviews`,
      )
    }

    const skillHits = roleHaystack ? story.skills.filter((skill) => matchesTerm(roleHaystack, skill)) : []
    if (skillHits.length > 0) {
      score += skillHits.length * 2
      reasons.push(`The posting mentions ${skillHits.slice(0, 3).join(', ')}`)
    }

    const tagOverlap = story.tags.filter((tag) => opportunityTags.includes(normalize(tag)))
    if (tagOverlap.length > 0) {
      score += tagOverlap.length * 2
      reasons.push(`Tagged ${tagOverlap.join(', ')}, like this opportunity`)
    }

    if (story.favorite && score > 0) {
      score += 1
      reasons.push('One of your favourites')
    }

    // Nudge toward stories that have not been used lately, to avoid repetition.
    if (score > 0 && story.useCount === 0) {
      score += 0.5
      reasons.push('Not used in an interview yet')
    }

    if (score > 0) suggestions.push({ story, score, reasons: uniq(reasons) })
  }

  return suggestions
    .sort((a, b) => b.score - a.score || a.story.title.localeCompare(b.story.title))
    .slice(0, limit)
}

/** True when a story has enough substance to be usable in an interview. */
export function storyCompleteness(story: Story): { filled: number; total: number; missing: string[] } {
  const parts: Array<[string, string | undefined]> = [
    ['Situation', story.situation],
    ['Task', story.task],
    ['Action', story.action],
    ['Result', story.result],
  ]
  const missing = parts.filter(([, value]) => !value?.trim()).map(([label]) => label)
  return { filled: parts.length - missing.length, total: parts.length, missing }
}

export function searchStories(stories: Story[], query: string): Story[] {
  const q = normalize(query)
  if (!q) return stories
  const terms = q.split(/\s+/).filter(Boolean)
  return stories.filter((s) => {
    const haystack = normalize(
      [s.title, s.situation, s.task, s.action, s.result, s.metrics, s.skills.join(' '), s.tags.join(' ')]
        .filter(Boolean)
        .join(' | '),
    )
    return terms.every((term) => haystack.includes(term))
  })
}
