/**
 * Capturing an opportunity from outside the app.
 *
 * Three doors, one road: a bookmarklet on the desktop, the operating system's
 * share sheet on mobile, and a plain link anyone can construct. All of them
 * land on the same query parameters and open the normal Add dialog with the
 * fields filled in, so nothing about capture is a special case.
 *
 * No page is ever fetched or scraped. The bookmarklet reads the tab the user is
 * already looking at, in their own browser, and hands over the title and URL.
 */
import { guessFromUrl } from './parse'
import { normalizeUrl } from './utils'

export interface CapturePrefill {
  company?: string
  role?: string
  jobUrl?: string
  source?: string
  notes?: string
}

/** Words that mark a fragment as a job title rather than a company name. */
const ROLE_WORDS = [
  'manager',
  'engineer',
  'designer',
  'analyst',
  'scientist',
  'director',
  'lead',
  'head',
  'developer',
  'architect',
  'consultant',
  'specialist',
  'associate',
  'president',
  'officer',
  'intern',
  'researcher',
  'marketer',
  'recruiter',
  'strategist',
  'coordinator',
  'administrator',
  'partner',
]

/** Trailing fragments that are site furniture, not part of the posting. */
const SITE_NOISE =
  /^(linkedin|indeed|glassdoor|greenhouse|lever|ashby|workday|smartrecruiters|jobs?|careers?|hiring|apply|job application|we are hiring|now hiring)$/i

/**
 * Hosts where the company name is genuinely in the path. Everywhere else the
 * hostname is a poor guess — "jobs.example.com" would yield "Jobs" — so the
 * page title is trusted first.
 */
const BOARD_HOSTS = [
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.lever.co',
  'jobs.ashbyhq.com',
]

function isBoardUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    return BOARD_HOSTS.includes(new URL(url).hostname.replace(/^www\./, ''))
  } catch {
    return false
  }
}

function looksLikeRole(fragment: string): boolean {
  const lower = fragment.toLowerCase()
  return ROLE_WORDS.some((word) => lower.includes(word))
}

function clean(fragment: string): string {
  return fragment
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|:,]+|[\s\-–—|:,]+$/g, '')
    .trim()
}

/**
 * Best-effort split of a page title into a role and a company.
 *
 * Titles arrive in a handful of shapes — "Senior PM - Halcyon Pay | LinkedIn",
 * "Halcyon Pay hiring Senior PM", "Senior PM at Halcyon Pay". Anything that
 * cannot be read confidently is left for the user to type; a wrong guess in a
 * prefilled field is worse than an empty one.
 */
export function parseSharedTitle(rawTitle: string, url?: string): { company?: string; role?: string } {
  const title = clean(rawTitle ?? '')
  if (!title) return {}

  // Drop trailing site furniture: "… | LinkedIn", "… - Greenhouse".
  let working = title
  for (let i = 0; i < 3; i++) {
    const match = /^(.*)[|\-–—]\s*([^|\-–—]+)$/.exec(working)
    if (!match?.[1] || !match[2]) break
    if (!SITE_NOISE.test(clean(match[2]))) break
    working = clean(match[1])
  }

  // "Company hiring Role" (LinkedIn's shape).
  const hiring = /^(.+?)\s+hiring\s+(.+)$/i.exec(working)
  if (hiring?.[1] && hiring[2]) {
    return { company: clean(hiring[1]), role: clean(hiring[2]) }
  }

  // "Role at Company" / "Role @ Company".
  const at = /^(.+?)\s+(?:at|@)\s+(.+)$/i.exec(working)
  if (at?.[1] && at[2] && looksLikeRole(at[1])) {
    return { role: clean(at[1]), company: clean(at[2]) }
  }

  // "Role - Company" or "Company: Role" — decide by which half reads as a role.
  const split = /^(.+?)\s*[-–—:|]\s*(.+)$/.exec(working)
  if (split?.[1] && split[2]) {
    const left = clean(split[1])
    const right = clean(split[2])
    const leftIsRole = looksLikeRole(left)
    const rightIsRole = looksLikeRole(right)
    if (leftIsRole && !rightIsRole) return { role: left, company: right }
    if (rightIsRole && !leftIsRole) return { role: right, company: left }
  }

  // A single fragment: treat it as the role if it reads like one. The company
  // only comes from the address when the address actually carries one.
  if (looksLikeRole(working)) {
    const fromBoard = isBoardUrl(url) ? guessFromUrl(url as string).company : undefined
    return { role: working, company: fromBoard }
  }
  return {}
}

/**
 * Builds a prefill from whatever the caller supplied. The URL is authoritative
 * for the company when it comes from a known job board; the title fills gaps.
 */
export function buildCapturePrefill(params: {
  url?: string | null
  title?: string | null
  company?: string | null
  role?: string | null
  source?: string | null
  text?: string | null
}): CapturePrefill | null {
  const jobUrl = normalizeUrl(params.url ?? undefined) ?? normalizeUrl(extractUrl(params.text ?? ''))
  const fromTitle = parseSharedTitle(params.title ?? '', jobUrl)
  const fromUrl = jobUrl ? guessFromUrl(jobUrl) : {}

  // Order of trust: what the caller stated, then a job board's own path, then
  // the page title, and only then a bare hostname.
  const boardCompany = isBoardUrl(jobUrl) ? fromUrl.company : undefined
  const company =
    clean(params.company ?? '') ||
    // A board slug is lower-cased and run together ("meridiansystems"); if the
    // page title spells the same name properly, use that instead.
    preferBetterSpelling(boardCompany, fromTitle.company) ||
    fromTitle.company ||
    fromUrl.company
  const role = clean(params.role ?? '') || fromTitle.role || fromUrl.role

  if (!company && !role && !jobUrl) return null
  return {
    company: company || undefined,
    role: role || undefined,
    jobUrl,
    source: clean(params.source ?? '') || undefined,
  }
}

/** Same name, better typography: keeps the version a human would write. */
function preferBetterSpelling(slugVersion?: string, titleVersion?: string): string | undefined {
  if (!slugVersion) return undefined
  if (!titleVersion) return slugVersion
  const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  return squash(slugVersion) === squash(titleVersion) ? titleVersion : slugVersion
}

function extractUrl(text: string): string | undefined {
  const match = /https?:\/\/\S+/.exec(text)
  return match?.[0]
}

/**
 * Reads capture parameters from the current address, whether they arrived on
 * the query string (share target, plain link) or inside the hash route.
 * Returns the prefill and a cleaned address to replace it with.
 */
export function readCaptureFromLocation(href: string): {
  prefill: CapturePrefill
  cleanedHref: string
} | null {
  let parsed: URL
  try {
    parsed = new URL(href)
  } catch {
    return null
  }

  const hashQueryIndex = parsed.hash.indexOf('?')
  const hashParams =
    hashQueryIndex >= 0 ? new URLSearchParams(parsed.hash.slice(hashQueryIndex + 1)) : new URLSearchParams()
  const isAddRoute = /^#\/add\b/.test(parsed.hash)

  const pick = (key: string): string | null => hashParams.get(key) ?? parsed.searchParams.get(key)
  const hasAny = ['url', 'title', 'company', 'role', 'text'].some((key) => pick(key))
  if (!hasAny && !isAddRoute) return null

  const prefill = buildCapturePrefill({
    url: pick('url'),
    title: pick('title'),
    company: pick('company'),
    role: pick('role'),
    source: pick('source'),
    text: pick('text'),
  })
  if (!prefill) return null

  // Strip the capture parameters so a refresh does not reopen the dialog.
  for (const key of ['url', 'title', 'company', 'role', 'source', 'text']) {
    parsed.searchParams.delete(key)
    hashParams.delete(key)
  }
  const remainingHash = hashParams.toString()
  const basePath = isAddRoute ? '#/opportunities' : (parsed.hash.split('?')[0] ?? '#/today')
  parsed.hash = remainingHash ? `${basePath}?${remainingHash}` : basePath || '#/today'

  return { prefill, cleanedHref: parsed.toString() }
}

/**
 * The bookmarklet source. Kept small and readable — anyone can inspect what
 * they are about to put in their bookmarks bar, and it only reads the title and
 * address of the tab it runs on.
 */
export function buildBookmarklet(appUrl: string): string {
  const base = appUrl.split('#')[0] ?? appUrl
  const source = `(function(){
var u=encodeURIComponent(location.href);
var t=encodeURIComponent(document.title||'');
window.open('${base}#/add?url='+u+'&title='+t+'&source=Bookmarklet','_blank','noopener');
})()`
  return `javascript:${encodeURIComponent(source.replace(/\n/g, ''))}`
}
