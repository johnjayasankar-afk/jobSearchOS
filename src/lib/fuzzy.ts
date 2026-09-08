/**
 * Fuzzy matching for the command palette.
 *
 * Typing "hlcn" should find "Halcyon Pay" and "wkrv" should find "Weekly
 * review". This is a subsequence matcher with a small, explainable scoring
 * model — contiguous runs and matches at the start of a word count for more,
 * because that is what people actually type.
 *
 * It also returns where it matched, so the result can be shown highlighted
 * rather than leaving the user to guess why a row came back.
 */

export interface FuzzyMatch {
  score: number
  /** Indices in the haystack that matched, ascending. */
  indices: number[]
}

const SCORE_EXACT_PREFIX = 120
const SCORE_WORD_START = 14
const SCORE_CONSECUTIVE = 9
const SCORE_MATCH = 2
const PENALTY_LEADING = 2
const PENALTY_GAP = 1

function isWordBoundary(text: string, index: number): boolean {
  if (index === 0) return true
  const previous = text[index - 1] ?? ''
  return /[\s\-_/.,:(|]/.test(previous)
}

/** Whether the rest of a needle can still be matched from a given position. */
function canMatchFrom(needle: string, haystack: string, from: number): boolean {
  let at = from
  for (const char of needle) {
    const next = haystack.indexOf(char, at)
    if (next === -1) return false
    at = next + 1
  }
  return true
}

/**
 * Scores one query against one string. Returns null when the query is not a
 * subsequence of the text at all.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return { score: 0, indices: [] }
  const haystack = text.toLowerCase()
  if (needle.length > haystack.length) return null

  // A straight substring hit is the common case and always wins.
  const direct = haystack.indexOf(needle)
  if (direct >= 0) {
    const indices = Array.from({ length: needle.length }, (_, i) => direct + i)
    const bonus = direct === 0 ? SCORE_EXACT_PREFIX : isWordBoundary(text, direct) ? SCORE_EXACT_PREFIX / 2 : 0
    return { score: bonus + needle.length * SCORE_WORD_START - direct * PENALTY_GAP, indices }
  }

  const indices: number[] = []
  let score = 0
  let haystackIndex = 0
  let previousIndex = -1

  for (let n = 0; n < needle.length; n++) {
    const char = needle[n] as string
    // Taking the earliest occurrence is what makes the match reliable: it is
    // the greedy choice that succeeds whenever any subsequence would.
    const earliest = haystack.indexOf(char, haystackIndex)
    if (earliest === -1) return null

    let found = earliest
    // A later start-of-word occurrence usually reads better ("hlcn" pointing at
    // Halcyon rather than scattered letters), but only take it when the rest of
    // the query can still be matched after it.
    const rest = needle.slice(n + 1)
    for (let i = earliest; i < haystack.length; i++) {
      if (haystack[i] !== char || !isWordBoundary(text, i)) continue
      if (canMatchFrom(rest, haystack, i + 1)) found = i
      break
    }

    score += SCORE_MATCH
    if (isWordBoundary(text, found)) score += SCORE_WORD_START
    if (previousIndex >= 0 && found === previousIndex + 1) score += SCORE_CONSECUTIVE
    else if (previousIndex >= 0) score -= Math.min(found - previousIndex - 1, 6) * PENALTY_GAP

    indices.push(found)
    previousIndex = found
    haystackIndex = found + 1
  }

  score -= Math.min(indices[0] ?? 0, 10) * PENALTY_LEADING
  return { score, indices }
}

/**
 * Scores a query made of several words against a set of fields. Every word must
 * match somewhere; the best field for each word contributes its score.
 */
export function fuzzyScore(
  query: string,
  fields: { title: string; subtitle?: string; keywords?: string },
): { score: number; titleIndices: number[] } | null {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { score: 0, titleIndices: [] }

  let total = 0
  let titleIndices: number[] = []

  for (const word of words) {
    const inTitle = fuzzyMatch(word, fields.title)
    const inSubtitle = fields.subtitle ? fuzzyMatch(word, fields.subtitle) : null
    const inKeywords = fields.keywords ? fuzzyMatch(word, fields.keywords) : null

    const best = [
      inTitle ? { score: inTitle.score * 2, from: 'title' as const, match: inTitle } : null,
      inSubtitle ? { score: inSubtitle.score, from: 'subtitle' as const, match: inSubtitle } : null,
      // Hidden keywords make a row findable but should not out-rank a visible hit.
      inKeywords ? { score: inKeywords.score * 0.4, from: 'keywords' as const, match: inKeywords } : null,
    ]
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)[0]

    if (!best) return null
    total += best.score
    if (best.from === 'title' && titleIndices.length === 0) titleIndices = best.match.indices
  }

  return { score: total, titleIndices }
}

export interface HighlightSegment {
  text: string
  match: boolean
}

/** Splits a string into matched and unmatched runs for rendering. */
export function highlightSegments(text: string, indices: number[]): HighlightSegment[] {
  if (indices.length === 0) return [{ text, match: false }]
  const flags = new Set(indices)
  const segments: HighlightSegment[] = []
  let current = ''
  let currentMatch = flags.has(0)

  for (let i = 0; i < text.length; i++) {
    const isMatch = flags.has(i)
    if (isMatch !== currentMatch) {
      if (current) segments.push({ text: current, match: currentMatch })
      current = ''
      currentMatch = isMatch
    }
    current += text[i]
  }
  if (current) segments.push({ text: current, match: currentMatch })
  return segments
}
