/**
 * Transparent fit scoring.
 *
 * The score is a weighted average of independent components. Components the
 * workspace cannot evaluate (no job description, no salary stated, no profile
 * entry) are marked `unknown` and *excluded from the denominator* rather than
 * silently scored as zero or as a neutral guess. That keeps the number honest
 * and lets the UI report how much of the score is actually grounded in data.
 *
 * Nothing here infers credentials the user has not entered.
 */
import { matchesTerm, extractYears, findVocabulary } from './parse'
import { VOCABULARY } from './skills-dictionary'
import { SENIORITY_META, type MasterProfile, type Opportunity, type SeniorityLevel } from './types'
import { clamp, normalize, uniq } from './utils'

export type ComponentStatus = 'strong' | 'partial' | 'weak' | 'unknown'

export interface FitComponent {
  id: 'role' | 'skills' | 'domain' | 'seniority' | 'location' | 'compensation' | 'preferences'
  label: string
  /** Maximum points this component can contribute. */
  weight: number
  /** Points earned, 0..weight. `null` when the component cannot be evaluated. */
  earned: number | null
  status: ComponentStatus
  matches: string[]
  gaps: string[]
  /** Plain-language explanation of how this component was decided. */
  note: string
}

export interface FitResult {
  /** 0–100, or null when there is not enough profile data to score at all. */
  score: number | null
  band: string
  tone: 'positive' | 'accent' | 'caution' | 'critical' | 'neutral'
  /** Share of total weight that could actually be evaluated, 0..1. */
  coverage: number
  confidence: 'high' | 'medium' | 'low'
  components: FitComponent[]
  matches: string[]
  gaps: string[]
  /** Concrete things the user could add to make the score more reliable. */
  improveHints: string[]
}

const WEIGHTS = {
  role: 25,
  skills: 25,
  domain: 15,
  seniority: 10,
  location: 10,
  compensation: 10,
  preferences: 5,
} as const

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)

const SENIORITY_TOKENS: Array<{ level: SeniorityLevel; tokens: string[] }> = [
  { level: 'intern', tokens: ['intern', 'internship'] },
  { level: 'junior', tokens: ['junior', 'entry level', 'associate', 'graduate', 'apprentice'] },
  { level: 'senior', tokens: ['senior', 'sr.', 'sr '] },
  { level: 'staff', tokens: ['staff'] },
  { level: 'principal', tokens: ['principal', 'distinguished'] },
  { level: 'manager', tokens: ['manager of', 'engineering manager', 'design manager', 'people manager'] },
  { level: 'director', tokens: ['director', 'head of'] },
  { level: 'vp', tokens: ['vp', 'vice president'] },
  { level: 'executive', tokens: ['chief', 'cto', 'cpo', 'ceo', 'coo', 'cmo'] },
]

/** Reads a seniority level out of a job title, when one is stated. */
export function detectSeniority(title: string): SeniorityLevel | null {
  const t = ` ${normalize(title)} `
  // Most senior / most specific levels win, so scan from the top down.
  for (const { level, tokens } of [...SENIORITY_TOKENS].reverse()) {
    if (tokens.some((tok) => matchesTerm(t, tok.trim()))) return level
  }
  return null
}

function stringOverlap(a: string, b: string): number {
  const at = uniq(normalize(a).split(/[^a-z0-9+#]+/).filter((w) => w.length > 1))
  const bt = new Set(uniq(normalize(b).split(/[^a-z0-9+#]+/).filter((w) => w.length > 1)))
  if (at.length === 0) return 0
  const hits = at.filter((w) => bt.has(w)).length
  return hits / at.length
}

const NOISE_WORDS = new Set(['senior', 'sr', 'staff', 'principal', 'lead', 'junior', 'associate', 'i', 'ii', 'iii', 'the', 'of', 'and'])

function coreTokens(s: string): string[] {
  return uniq(
    normalize(s)
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 1 && !NOISE_WORDS.has(w)),
  )
}

export function profileIsUsable(profile: MasterProfile | null | undefined): boolean {
  if (!profile) return false
  return (
    profile.targetRoles.length > 0 ||
    profile.skills.length > 0 ||
    profile.domains.length > 0 ||
    Boolean(profile.minCompensation) ||
    profile.locations.length > 0
  )
}

export function computeFit(
  opportunity: Pick<
    Opportunity,
    | 'role'
    | 'company'
    | 'jobDescription'
    | 'location'
    | 'workArrangement'
    | 'salaryMin'
    | 'salaryMax'
    | 'currency'
    | 'tags'
  >,
  profile: MasterProfile | null | undefined,
): FitResult {
  const improveHints: string[] = []

  if (!profileIsUsable(profile) || !profile) {
    return {
      score: null,
      band: 'Not scored',
      tone: 'neutral',
      coverage: 0,
      confidence: 'low',
      components: [],
      matches: [],
      gaps: [],
      improveHints: ['Fill in your Master Profile in Settings to turn on fit scoring.'],
    }
  }

  const jd = opportunity.jobDescription ?? ''
  const haystack = normalize(
    [opportunity.role, opportunity.company, opportunity.location ?? '', jd, opportunity.tags.join(' ')].join('\n'),
  )
  const hasJd = jd.trim().length >= 120
  if (!hasJd) improveHints.push('Paste the job description to score skills and seniority.')

  const components: FitComponent[] = []

  /* ---- 1. Role alignment ------------------------------------------------ */
  {
    const targets = profile.targetRoles.filter(Boolean)
    if (targets.length === 0) {
      components.push({
        id: 'role',
        label: 'Role alignment',
        weight: WEIGHTS.role,
        earned: null,
        status: 'unknown',
        matches: [],
        gaps: [],
        note: 'No target role titles in your profile.',
      })
      improveHints.push('Add target role titles to your Master Profile.')
    } else {
      let best = 0
      let bestTarget = ''
      for (const target of targets) {
        const oppCore = coreTokens(opportunity.role)
        const targetCore = coreTokens(target)
        const shared = targetCore.filter((t) => oppCore.includes(t))
        const ratio = targetCore.length === 0 ? 0 : shared.length / targetCore.length
        const exact = normalize(target) === normalize(opportunity.role) ? 1 : 0
        const value = Math.max(ratio, exact, stringOverlap(target, opportunity.role) * 0.9)
        if (value > best) {
          best = value
          bestTarget = target
        }
      }
      const earned = Math.round(WEIGHTS.role * clamp(best, 0, 1) * 10) / 10
      components.push({
        id: 'role',
        label: 'Role alignment',
        weight: WEIGHTS.role,
        earned,
        status: best >= 0.85 ? 'strong' : best >= 0.5 ? 'partial' : 'weak',
        matches: best >= 0.5 ? [bestTarget] : [],
        gaps: best < 0.5 ? [`"${opportunity.role}" differs from your target titles`] : [],
        note:
          best >= 0.85
            ? `Title matches your target "${bestTarget}".`
            : best >= 0.5
              ? `Partial overlap with your target "${bestTarget}".`
              : 'Title does not overlap with your target roles.',
      })
    }
  }

  /* ---- 2. Skills -------------------------------------------------------- */
  {
    const mySkills = uniq([...profile.skills, ...profile.tools]).filter(Boolean)
    if (mySkills.length === 0 || !hasJd) {
      components.push({
        id: 'skills',
        label: 'Skills',
        weight: WEIGHTS.skills,
        earned: null,
        status: 'unknown',
        matches: [],
        gaps: [],
        note: mySkills.length === 0 ? 'No skills listed in your profile.' : 'No job description to compare against.',
      })
      if (mySkills.length === 0) improveHints.push('List your skills and tools in your Master Profile.')
    } else {
      // Which skills does the posting actually ask for?
      const asked = findVocabulary(jd, ['skill', 'tool'])
      const askedSet = new Set(asked.map(normalize))
      const mine = new Set(mySkills.map(normalize))

      const matched = asked.filter((s) => {
        if (mine.has(normalize(s))) return true
        // profile may name an alias of the same vocabulary entry
        const entry = VOCABULARY.find((v) => v.label === s)
        return Boolean(entry && entry.aliases.some((a) => mine.has(normalize(a))))
      })
      // Skills the user has that the posting mentions but the vocabulary missed.
      const freeformMatches = mySkills.filter((s) => !askedSet.has(normalize(s)) && matchesTerm(haystack, s))
      const allMatches = uniq([...matched, ...freeformMatches])
      const missing = asked.filter((s) => !matched.includes(s))

      const denominator = Math.max(3, Math.min(asked.length, 10))
      const ratio = denominator === 0 ? 0 : clamp(allMatches.length / denominator, 0, 1)
      const earned = Math.round(WEIGHTS.skills * ratio * 10) / 10
      components.push({
        id: 'skills',
        label: 'Skills',
        weight: WEIGHTS.skills,
        earned,
        status: ratio >= 0.75 ? 'strong' : ratio >= 0.4 ? 'partial' : 'weak',
        matches: allMatches.slice(0, 10),
        gaps: missing.slice(0, 6).map((skill) => `${skill} is asked for but not in your profile`),
        note:
          asked.length === 0
            ? 'The description does not name recognisable skills.'
            : `${allMatches.length} of ${asked.length} named skills are in your profile.`,
      })
    }
  }

  /* ---- 3. Domain -------------------------------------------------------- */
  {
    const myDomains = uniq([...profile.domains, ...profile.industries]).filter(Boolean)
    if (myDomains.length === 0) {
      components.push({
        id: 'domain',
        label: 'Domain',
        weight: WEIGHTS.domain,
        earned: null,
        status: 'unknown',
        matches: [],
        gaps: [],
        note: 'No domain expertise in your profile.',
      })
      improveHints.push('Add your domain expertise (e.g. Fintech, AI) to your profile.')
    } else {
      const postingDomains = uniq([
        ...findVocabulary([opportunity.role, opportunity.company, jd].join('\n'), ['domain']),
        ...opportunity.tags,
      ])
      const matches = myDomains.filter((d) => matchesTerm(haystack, d))
      const unmatchedPosting = postingDomains.filter(
        (d) => !myDomains.some((m) => normalize(m) === normalize(d)),
      )
      const ratio = matches.length === 0 ? 0 : clamp(matches.length / Math.min(myDomains.length, 3), 0, 1)
      const earned = Math.round(WEIGHTS.domain * ratio * 10) / 10
      components.push({
        id: 'domain',
        label: 'Domain',
        weight: WEIGHTS.domain,
        earned,
        status: ratio >= 0.66 ? 'strong' : ratio > 0 ? 'partial' : 'weak',
        matches,
        gaps: unmatchedPosting.slice(0, 4).map((d) => `${d} not present in your profile`),
        note:
          matches.length > 0
            ? `Overlaps with your experience in ${matches.slice(0, 3).join(', ')}.`
            : 'No overlap with the domains in your profile.',
      })
    }
  }

  /* ---- 4. Seniority ----------------------------------------------------- */
  {
    const postingLevel = detectSeniority(opportunity.role)
    // A years-of-experience line is worth reading even from a short snippet.
    const yearsAsked = extractYears(jd)
    const myLevel = profile.seniority
    const myYears = profile.yearsExperience

    if ((!postingLevel && !yearsAsked) || (!myLevel && myYears === undefined)) {
      components.push({
        id: 'seniority',
        label: 'Seniority',
        weight: WEIGHTS.seniority,
        earned: null,
        status: 'unknown',
        matches: [],
        gaps: [],
        note: !postingLevel && !yearsAsked ? 'The posting does not state a level or years of experience.' : 'No seniority or years of experience in your profile.',
      })
      if (myLevel === undefined && myYears === undefined) {
        improveHints.push('Set your seniority and years of experience in your profile.')
      }
    } else {
      const matches: string[] = []
      const gaps: string[] = []
      let value = 1

      if (postingLevel && myLevel) {
        const diff = SENIORITY_META[postingLevel].rank - SENIORITY_META[myLevel].rank
        if (diff === 0) matches.push(`${SENIORITY_META[postingLevel].label} level`)
        else if (diff === 1) {
          value = Math.min(value, 0.7)
          gaps.push(`Posting is one level above your profile (${SENIORITY_META[postingLevel].label})`)
        } else if (diff > 1) {
          value = Math.min(value, 0.35)
          gaps.push(`Posting is ${diff} levels above your profile (${SENIORITY_META[postingLevel].label})`)
        } else if (diff === -1) {
          value = Math.min(value, 0.75)
          gaps.push(`Posting is a level below your profile (${SENIORITY_META[postingLevel].label})`)
        } else {
          value = Math.min(value, 0.5)
          gaps.push(`Posting is more junior than your profile (${SENIORITY_META[postingLevel].label})`)
        }
      }

      const effectiveYears = myYears ?? (myLevel ? SENIORITY_META[myLevel].typicalYears : undefined)
      if (yearsAsked && effectiveYears !== undefined) {
        if (effectiveYears >= yearsAsked.min) {
          matches.push(`${effectiveYears} yrs experience meets the ${yearsAsked.min}+ requirement`)
        } else {
          const shortfall = yearsAsked.min - effectiveYears
          value = Math.min(value, shortfall <= 1 ? 0.75 : shortfall <= 3 ? 0.45 : 0.15)
          gaps.push(`Posting asks for ${yearsAsked.min}+ years; your profile says ${effectiveYears}`)
        }
      } else if (yearsAsked) {
        gaps.push(`Posting asks for ${yearsAsked.min}+ years`)
        value = Math.min(value, 0.6)
      }

      const earned = Math.round(WEIGHTS.seniority * clamp(value, 0, 1) * 10) / 10
      components.push({
        id: 'seniority',
        label: 'Seniority',
        weight: WEIGHTS.seniority,
        earned,
        status: value >= 0.9 ? 'strong' : value >= 0.5 ? 'partial' : 'weak',
        matches,
        gaps,
        note: gaps.length === 0 ? 'Level and experience line up.' : gaps[0] ?? '',
      })
    }
  }

  /* ---- 5. Location ------------------------------------------------------ */
  {
    const pref = profile.remotePreference
    const arrangement = opportunity.workArrangement
    const myLocations = profile.locations.filter(Boolean)
    const oppLocation = opportunity.location ?? ''

    if (arrangement === 'unknown' && !oppLocation && myLocations.length === 0) {
      components.push({
        id: 'location',
        label: 'Location',
        weight: WEIGHTS.location,
        earned: null,
        status: 'unknown',
        matches: [],
        gaps: [],
        note: 'No location or work arrangement recorded.',
      })
    } else {
      const matches: string[] = []
      const gaps: string[] = []
      let value = 0.6

      if (arrangement === 'remote') {
        value = pref === 'onsite' ? 0.6 : 1
        matches.push('Remote')
      } else if (arrangement !== 'unknown') {
        const geoMatch = myLocations.find((loc) => matchesTerm(normalize(oppLocation), loc) || matchesTerm(normalize(loc), oppLocation))
        if (geoMatch) {
          matches.push(geoMatch)
          value = pref === 'remote' ? 0.75 : 1
        } else if (profile.willingToRelocate) {
          value = 0.6
          gaps.push(`${oppLocation || 'On-site role'} is outside your preferred locations, but you are open to relocating`)
        } else {
          value = myLocations.length === 0 ? 0.6 : 0.2
          if (myLocations.length > 0) gaps.push(`${oppLocation || 'On-site role'} is not in your preferred locations`)
        }
        if (pref === 'remote' && arrangement === 'onsite') {
          value = Math.min(value, 0.35)
          gaps.push('You prefer remote work; this role is on-site')
        }
        if (arrangement === 'hybrid' && pref === 'remote') {
          value = Math.min(value, 0.6)
        }
      } else {
        const geoMatch = myLocations.find((loc) => oppLocation && matchesTerm(normalize(oppLocation), loc))
        if (geoMatch) {
          matches.push(geoMatch)
          value = 0.85
        } else {
          gaps.push('Work arrangement is not recorded')
          value = 0.6
        }
      }

      const earned = Math.round(WEIGHTS.location * clamp(value, 0, 1) * 10) / 10
      components.push({
        id: 'location',
        label: 'Location',
        weight: WEIGHTS.location,
        earned,
        status: value >= 0.9 ? 'strong' : value >= 0.55 ? 'partial' : 'weak',
        matches,
        gaps,
        note:
          matches.length > 0
            ? `Works with your location preferences (${matches.join(', ')}).`
            : (gaps[0] ?? 'Partial location information.'),
      })
    }
  }

  /* ---- 6. Compensation -------------------------------------------------- */
  {
    const target = profile.minCompensation
    const top = opportunity.salaryMax ?? opportunity.salaryMin
    if (!target || !top) {
      components.push({
        id: 'compensation',
        label: 'Compensation',
        weight: WEIGHTS.compensation,
        earned: null,
        status: 'unknown',
        matches: [],
        gaps: [],
        note: !target ? 'No minimum compensation in your profile.' : 'The posting does not state a salary range.',
      })
      if (!target) improveHints.push('Set your minimum compensation to score pay against your bar.')
    } else {
      const ratio = top / target
      const value = ratio >= 1.15 ? 1 : ratio >= 1 ? 0.9 : ratio >= 0.9 ? 0.6 : ratio >= 0.75 ? 0.3 : 0.05
      const earned = Math.round(WEIGHTS.compensation * value * 10) / 10
      const currencyMismatch = profile.currency !== opportunity.currency
      components.push({
        id: 'compensation',
        label: 'Compensation',
        weight: WEIGHTS.compensation,
        earned,
        status: value >= 0.9 ? 'strong' : value >= 0.6 ? 'partial' : 'weak',
        matches: value >= 0.9 ? ['Meets your compensation bar'] : [],
        gaps: value < 0.9 ? ['Top of range is below your stated minimum'] : [],
        note: currencyMismatch
          ? `Compared in different currencies (${opportunity.currency} vs ${profile.currency}) — verify manually.`
          : value >= 0.9
            ? 'Range meets or exceeds your minimum.'
            : 'Range falls short of your minimum.',
      })
    }
  }

  /* ---- 7. Other preferences -------------------------------------------- */
  {
    const desired = profile.desiredKeywords.filter(Boolean)
    const undesired = profile.undesiredKeywords.filter(Boolean)
    if (desired.length === 0 && undesired.length === 0) {
      components.push({
        id: 'preferences',
        label: 'Preferences',
        weight: WEIGHTS.preferences,
        earned: null,
        status: 'unknown',
        matches: [],
        gaps: [],
        note: 'No desired or undesired keywords set.',
      })
    } else {
      const hitDesired = desired.filter((k) => matchesTerm(haystack, k))
      const hitUndesired = undesired.filter((k) => matchesTerm(haystack, k))
      const positive = desired.length === 0 ? 0.6 : clamp(hitDesired.length / Math.min(desired.length, 3), 0, 1)
      const penalty = hitUndesired.length > 0 ? clamp(hitUndesired.length * 0.5, 0, 1) : 0
      const value = clamp(positive - penalty, 0, 1)
      const earned = Math.round(WEIGHTS.preferences * value * 10) / 10
      components.push({
        id: 'preferences',
        label: 'Preferences',
        weight: WEIGHTS.preferences,
        earned,
        status: value >= 0.75 ? 'strong' : value > 0.25 ? 'partial' : 'weak',
        matches: hitDesired,
        gaps: hitUndesired.map((k) => `Mentions "${k}", which you flagged to avoid`),
        note:
          hitUndesired.length > 0
            ? `Contains ${hitUndesired.length} keyword${hitUndesired.length === 1 ? '' : 's'} you want to avoid.`
            : hitDesired.length > 0
              ? `Mentions ${hitDesired.slice(0, 3).join(', ')}.`
              : 'None of your keywords appear.',
      })
    }
  }

  /* ---- aggregate -------------------------------------------------------- */
  const scored = components.filter((c) => c.earned !== null)
  const availableWeight = scored.reduce((a, c) => a + c.weight, 0)
  const earnedPoints = scored.reduce((a, c) => a + (c.earned ?? 0), 0)
  const coverage = availableWeight / TOTAL_WEIGHT

  if (availableWeight === 0) {
    return {
      score: null,
      band: 'Not scored',
      tone: 'neutral',
      coverage: 0,
      confidence: 'low',
      components,
      matches: [],
      gaps: [],
      improveHints: uniq(improveHints),
    }
  }

  const score = Math.round((earnedPoints / availableWeight) * 100)
  const confidence: FitResult['confidence'] = coverage >= 0.8 ? 'high' : coverage >= 0.5 ? 'medium' : 'low'

  return {
    score,
    band: bandLabel(score, confidence),
    tone: score >= 80 ? 'positive' : score >= 62 ? 'accent' : score >= 45 ? 'caution' : 'critical',
    coverage,
    confidence,
    components,
    matches: uniq(components.flatMap((c) => c.matches)),
    gaps: uniq(components.flatMap((c) => c.gaps)),
    improveHints: uniq(improveHints),
  }
}

export function bandLabel(score: number, confidence: FitResult['confidence']): string {
  const base = score >= 85 ? 'Strong match' : score >= 70 ? 'Good match' : score >= 55 ? 'Moderate match' : score >= 40 ? 'Weak match' : 'Poor match'
  return confidence === 'low' ? `${base} · provisional` : base
}

export function fitTone(score: number | null): FitResult['tone'] {
  if (score === null) return 'neutral'
  return score >= 80 ? 'positive' : score >= 62 ? 'accent' : score >= 45 ? 'caution' : 'critical'
}
