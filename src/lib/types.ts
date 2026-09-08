/**
 * Domain model for Opportunity OS.
 *
 * Conventions
 * - `Timestamp` values are full ISO-8601 strings (createdAt/updatedAt/event times).
 * - `DateOnly` values are `YYYY-MM-DD` and represent a calendar day in the user's
 *   local timezone. Calendar days are stored without a time component so that a
 *   "next action due Friday" never shifts across a timezone boundary.
 */

export type Timestamp = string
export type DateOnly = string
export type ID = string

/* -------------------------------------------------------------------------- */
/*  Opportunity                                                               */
/* -------------------------------------------------------------------------- */

export const STAGES = [
  'saved',
  'evaluating',
  'applying',
  'applied',
  'recruiter_screen',
  'hiring_manager',
  'case_technical',
  'onsite',
  'final_round',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
] as const

export type Stage = (typeof STAGES)[number]

export interface StageMeta {
  id: Stage
  label: string
  /** Short label used where horizontal space is tight (board columns, chips). */
  short: string
  group: 'exploring' | 'applying' | 'interviewing' | 'closed'
  /** Stages that represent a live, in-progress pursuit. */
  active: boolean
  /** Ordering used for the funnel and "furthest stage reached" logic. */
  order: number
  /** Colour token key used for chips and board accents. */
  tone: Tone
}

export type Tone = 'neutral' | 'accent' | 'positive' | 'caution' | 'critical' | 'info'

export const STAGE_META: Record<Stage, StageMeta> = {
  saved: { id: 'saved', label: 'Saved', short: 'Saved', group: 'exploring', active: true, order: 0, tone: 'neutral' },
  evaluating: { id: 'evaluating', label: 'Evaluating', short: 'Evaluating', group: 'exploring', active: true, order: 1, tone: 'neutral' },
  applying: { id: 'applying', label: 'Applying', short: 'Applying', group: 'applying', active: true, order: 2, tone: 'info' },
  applied: { id: 'applied', label: 'Applied', short: 'Applied', group: 'applying', active: true, order: 3, tone: 'info' },
  recruiter_screen: { id: 'recruiter_screen', label: 'Recruiter Screen', short: 'Recruiter', group: 'interviewing', active: true, order: 4, tone: 'accent' },
  hiring_manager: { id: 'hiring_manager', label: 'Hiring Manager', short: 'Hiring Mgr', group: 'interviewing', active: true, order: 5, tone: 'accent' },
  case_technical: { id: 'case_technical', label: 'Case / Technical', short: 'Case / Tech', group: 'interviewing', active: true, order: 6, tone: 'accent' },
  onsite: { id: 'onsite', label: 'Onsite', short: 'Onsite', group: 'interviewing', active: true, order: 7, tone: 'accent' },
  final_round: { id: 'final_round', label: 'Final Round', short: 'Final', group: 'interviewing', active: true, order: 8, tone: 'accent' },
  offer: { id: 'offer', label: 'Offer', short: 'Offer', group: 'interviewing', active: true, order: 9, tone: 'positive' },
  accepted: { id: 'accepted', label: 'Accepted', short: 'Accepted', group: 'closed', active: false, order: 10, tone: 'positive' },
  rejected: { id: 'rejected', label: 'Rejected', short: 'Rejected', group: 'closed', active: false, order: 11, tone: 'critical' },
  withdrawn: { id: 'withdrawn', label: 'Withdrawn', short: 'Withdrawn', group: 'closed', active: false, order: 12, tone: 'neutral' },
}

export const ACTIVE_STAGES: Stage[] = STAGES.filter((s) => STAGE_META[s].active)
export const CLOSED_STAGES: Stage[] = STAGES.filter((s) => !STAGE_META[s].active)
/** Stages that mean an application has actually been submitted. */
export const POST_APPLY_STAGES: Stage[] = STAGES.filter((s) => STAGE_META[s].order >= STAGE_META.applied.order && s !== 'withdrawn')
/** Stages that mean the user has spoken with a human at the company. */
export const INTERVIEWING_STAGES: Stage[] = STAGES.filter((s) => STAGE_META[s].group === 'interviewing')

export const PRIORITIES = ['high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_META: Record<Priority, { label: string; short: string; weight: number; tone: Tone }> = {
  high: { label: 'High', short: 'H', weight: 3, tone: 'critical' },
  medium: { label: 'Medium', short: 'M', weight: 2, tone: 'caution' },
  low: { label: 'Low', short: 'L', weight: 1, tone: 'neutral' },
}

export const WORK_ARRANGEMENTS = ['remote', 'hybrid', 'onsite', 'unknown'] as const
export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number]

export const WORK_ARRANGEMENT_LABEL: Record<WorkArrangement, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Onsite',
  unknown: 'Unspecified',
}

export const SOURCE_SUGGESTIONS = [
  'LinkedIn',
  'Referral',
  'Company Site',
  'Recruiter Outreach',
  'Job Board',
  'Network',
  'Cold Outreach',
  'Alumni',
  'Other',
] as const

export interface RejectionInfo {
  date?: DateOnly
  /** Stage the process ended at. */
  stage?: Stage
  reason?: string
  notes?: string
}

export const OFFER_STATUSES = ['received', 'negotiating', 'accepted', 'declined', 'expired'] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

export interface OfferInfo {
  date?: DateOnly
  baseSalary?: number
  /** Annual target bonus, in currency rather than percent. */
  bonus?: number
  /** One-off signing payment. */
  signOn?: number
  /** How the grant was described, e.g. "0.08% over 4 years". */
  equity?: string
  /** Total value of the grant, if you can put a number on it. */
  equityValue?: number
  /** Years the grant vests over; 4 unless stated otherwise. */
  equityYears?: number
  currency?: string
  decisionDeadline?: DateOnly
  status: OfferStatus
  notes?: string
}

export interface Opportunity {
  id: ID
  company: string
  role: string
  jobUrl?: string
  location?: string
  workArrangement: WorkArrangement
  salaryMin?: number
  salaryMax?: number
  currency: string
  source?: string
  dateDiscovered: DateOnly
  dateApplied?: DateOnly
  /** Application deadline, if the posting states one. */
  deadline?: DateOnly
  stage: Stage
  priority: Priority
  /** User conviction ratings, 1–5. Distinct from the computed fit score. */
  interestScore?: number
  companyScore?: number
  roleScore?: number
  jobDescription?: string
  /** Overview fields. */
  whyInterested?: string
  strengths?: string
  concerns?: string
  notes?: string
  tags: string[]
  nextAction?: string
  nextActionDate?: DateOnly
  rejection?: RejectionInfo
  offer?: OfferInfo
  /** How this role rates against each of your criteria, by criterion id. */
  decisionRatings?: Record<string, DecisionRating>
  archivedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
  /** Timestamp of the last stage change; powers "time in stage". */
  stageChangedAt: Timestamp
  /**
   * Ordered record of every stage this opportunity has occupied. This is what
   * makes the funnel and time-in-stage analytics truthful — a record that was
   * rejected after an onsite still counts as having reached the onsite stage.
   */
  stageHistory: StageVisit[]
}

export interface StageVisit {
  stage: Stage
  at: Timestamp
}

/* -------------------------------------------------------------------------- */
/*  Contact                                                                    */
/* -------------------------------------------------------------------------- */

export const RELATIONSHIPS = [
  'recruiter',
  'hiring_manager',
  'employee',
  'referral',
  'friend',
  'alumni',
  'founder',
  'investor',
  'other',
] as const
export type Relationship = (typeof RELATIONSHIPS)[number]

export const RELATIONSHIP_META: Record<Relationship, { label: string; tone: Tone }> = {
  recruiter: { label: 'Recruiter', tone: 'info' },
  hiring_manager: { label: 'Hiring Manager', tone: 'accent' },
  employee: { label: 'Employee', tone: 'neutral' },
  referral: { label: 'Referral', tone: 'positive' },
  friend: { label: 'Friend', tone: 'neutral' },
  alumni: { label: 'Alumni', tone: 'neutral' },
  founder: { label: 'Founder', tone: 'caution' },
  investor: { label: 'Investor', tone: 'caution' },
  other: { label: 'Other', tone: 'neutral' },
}

export interface Contact {
  id: ID
  name: string
  company?: string
  title?: string
  linkedinUrl?: string
  email?: string
  phone?: string
  relationship: Relationship
  opportunityIds: ID[]
  lastContactDate?: DateOnly
  nextFollowUpDate?: DateOnly
  notes?: string
  tags: string[]
  archivedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

/* -------------------------------------------------------------------------- */
/*  Interview                                                                  */
/* -------------------------------------------------------------------------- */

export const INTERVIEW_TYPES = [
  'recruiter',
  'hiring_manager',
  'product_sense',
  'product_execution',
  'case',
  'technical',
  'behavioral',
  'founder',
  'panel',
  'other',
] as const
export type InterviewType = (typeof INTERVIEW_TYPES)[number]

export const INTERVIEW_TYPE_META: Record<InterviewType, { label: string; /** Story tags that tend to be useful for this format. */ storyTags: string[] }> = {
  recruiter: { label: 'Recruiter', storyTags: ['Execution'] },
  hiring_manager: { label: 'Hiring Manager', storyTags: ['Leadership', 'Stakeholders', 'Execution'] },
  product_sense: { label: 'Product Sense', storyTags: ['0→1', 'Strategy', 'Growth'] },
  product_execution: { label: 'Product Execution', storyTags: ['Execution', 'Analytics', 'Growth'] },
  case: { label: 'Case', storyTags: ['Strategy', 'Analytics'] },
  technical: { label: 'Technical', storyTags: ['Technical', 'AI'] },
  behavioral: { label: 'Behavioral', storyTags: ['Leadership', 'Conflict', 'Failure', 'Stakeholders'] },
  founder: { label: 'Founder', storyTags: ['0→1', 'Strategy', 'Leadership'] },
  panel: { label: 'Panel', storyTags: ['Stakeholders', 'Leadership'] },
  other: { label: 'Other', storyTags: [] },
}

export const INTERVIEW_FORMATS = ['video', 'phone', 'onsite', 'async'] as const
export type InterviewFormat = (typeof INTERVIEW_FORMATS)[number]

export const INTERVIEW_OUTCOMES = ['pending', 'advanced', 'rejected', 'no_decision', 'cancelled'] as const
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number]

export const INTERVIEW_OUTCOME_META: Record<InterviewOutcome, { label: string; tone: Tone }> = {
  pending: { label: 'Awaiting result', tone: 'neutral' },
  advanced: { label: 'Advanced', tone: 'positive' },
  rejected: { label: 'Rejected', tone: 'critical' },
  no_decision: { label: 'No decision', tone: 'caution' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export interface ChecklistItem {
  id: ID
  text: string
  done: boolean
}

export const ANSWER_VERDICTS = ['well', 'ok', 'badly'] as const
export type AnswerVerdict = (typeof ANSWER_VERDICTS)[number]

export const ANSWER_VERDICT_META: Record<AnswerVerdict, { label: string; tone: Tone }> = {
  well: { label: 'Handled it', tone: 'positive' },
  ok: { label: 'Got through it', tone: 'neutral' },
  badly: { label: 'Struggled', tone: 'critical' },
}

export const DEBRIEF_READS = ['strong', 'mixed', 'weak'] as const
export type DebriefRead = (typeof DEBRIEF_READS)[number]

export const DEBRIEF_READ_META: Record<DebriefRead, { label: string; tone: Tone; hint: string }> = {
  strong: { label: 'Went well', tone: 'positive', hint: 'You would be happy to be judged on that.' },
  mixed: { label: 'Mixed', tone: 'caution', hint: 'Parts landed, parts did not.' },
  weak: { label: 'Went badly', tone: 'critical', hint: 'Worth knowing why while it is fresh.' },
}

/** One question you were actually asked, and how it went. */
export interface AskedQuestion {
  /** Id from the question bank, when it came from there. */
  questionId?: string
  /** The question as asked, for anything the bank does not carry. */
  text?: string
  verdict: AnswerVerdict
}

export interface Interview {
  id: ID
  opportunityId: ID
  /** Full local ISO datetime. */
  scheduledAt: Timestamp
  durationMinutes: number
  type: InterviewType
  format: InterviewFormat
  contactIds: ID[]
  /** Free-text interviewers who are not tracked as contacts. */
  interviewers?: string
  prepNotes?: string
  questionsExpected: string[]
  questionsToAsk: string[]
  checklist: ChecklistItem[]
  /** Stories the user has pinned to this interview. */
  storyIds: ID[]
  outcome: InterviewOutcome
  /** Free-text notes on how it went. */
  debrief?: string
  /** Set once the structured debrief has been completed. */
  debriefedAt?: Timestamp
  /** The questions you were actually asked, and how each went. */
  askedQuestions?: AskedQuestion[]
  /** Your own overall read on the conversation. */
  debriefRead?: DebriefRead
  /**
   * Last time the app asked what came of this interview. Set when you answer
   * "still waiting", so the question waits a week rather than asking daily.
   */
  outcomeAskedAt?: Timestamp
  followUpSent: boolean
  followUpDueDate?: DateOnly
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * A question you added yourself.
 *
 * The built-in bank leans product-management, because that is what it was
 * written from. Anyone in another discipline needs their own questions to sit
 * beside it on equal terms — counted in coverage, offered in drills, tickable
 * in a debrief — which is why these carry the same shape as a built-in.
 */
export interface CustomQuestion {
  id: ID
  text: string
  /** The theme a story needs to answer this. */
  theme: StoryTag
  /** Other themes that would also serve. */
  also?: StoryTag[]
  formats: InterviewType[]
  /** Your own note on what the question is really after. */
  listeningFor?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/* -------------------------------------------------------------------------- */
/*  Deciding on an offer                                                       */
/* -------------------------------------------------------------------------- */

export const CRITERION_WEIGHTS = [1, 2, 3] as const
export type CriterionWeight = (typeof CRITERION_WEIGHTS)[number]

export const WEIGHT_META: Record<CriterionWeight, { label: string; hint: string }> = {
  1: { label: 'Nice to have', hint: 'Would be good. Would not decide it.' },
  2: { label: 'Matters', hint: 'A real factor in the decision.' },
  3: { label: 'Decisive', hint: 'Get this wrong and the rest does not save it.' },
}

/**
 * Something you want from your next job.
 *
 * Kept on the workspace rather than the offer: what you want does not change
 * between two offers, and the point of writing it down is that it is decided
 * before an offer is in front of you and a deadline is running.
 */
export interface DecisionCriterion {
  id: ID
  label: string
  weight: CriterionWeight
}

export const DECISION_RATINGS = ['concern', 'fine', 'strength'] as const
export type DecisionRating = (typeof DECISION_RATINGS)[number]

export const RATING_META: Record<DecisionRating, { label: string; tone: Tone }> = {
  concern: { label: 'Concern', tone: 'critical' },
  fine: { label: 'Fine', tone: 'neutral' },
  strength: { label: 'Strength', tone: 'positive' },
}

/* -------------------------------------------------------------------------- */
/*  Story bank                                                                 */
/* -------------------------------------------------------------------------- */

export const STORY_TAGS = [
  'Leadership',
  'Conflict',
  '0→1',
  'Growth',
  'Technical',
  'AI',
  'Analytics',
  'Failure',
  'Strategy',
  'Execution',
  'Stakeholders',
] as const
export type StoryTag = (typeof STORY_TAGS)[number]

export interface Story {
  id: ID
  title: string
  situation?: string
  task?: string
  action?: string
  result?: string
  /** Quantified outcomes, e.g. "cut onboarding time 38%". */
  metrics?: string
  skills: string[]
  tags: string[]
  favorite: boolean
  lastUsedAt?: Timestamp
  useCount: number
  /** Times this story has been rehearsed out loud. */
  rehearsalCount?: number
  lastRehearsedAt?: Timestamp
  /** Your own verdict on the last run. Nothing grades the answer itself. */
  lastRehearsalRating?: RehearsalRating
  /**
   * The last few runs, newest first. Kept short on purpose: enough to say how
   * long you usually take and whether it is going better, not a training log.
   */
  recentRuns?: RehearsalRun[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export const REHEARSAL_RATINGS = ['solid', 'shaky'] as const
export type RehearsalRating = (typeof REHEARSAL_RATINGS)[number]

export interface RehearsalRun {
  at: Timestamp
  /** How long you spoke for. */
  seconds: number
  rating: RehearsalRating
}

/** How many runs to keep per story. */
export const MAX_RECENT_RUNS = 5

/* -------------------------------------------------------------------------- */
/*  Activity timeline                                                          */
/* -------------------------------------------------------------------------- */

export const EVENT_TYPES = [
  'opportunity_created',
  'stage_changed',
  'applied',
  'priority_changed',
  'next_action_set',
  'next_action_completed',
  'note_added',
  'contact_linked',
  'contact_logged',
  'interview_created',
  'interview_updated',
  'interview_result',
  'follow_up_completed',
  'offer_recorded',
  'rejected',
  'withdrawn',
  'archived',
  'unarchived',
  'opportunity_updated',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export interface ActivityEvent {
  id: ID
  at: Timestamp
  type: EventType
  /** Opportunity the event belongs to, when applicable. */
  opportunityId?: ID
  contactId?: ID
  interviewId?: ID
  summary: string
  detail?: string
}

/* -------------------------------------------------------------------------- */
/*  Master profile                                                             */
/* -------------------------------------------------------------------------- */

export const SENIORITY_LEVELS = [
  'intern',
  'junior',
  'mid',
  'senior',
  'staff',
  'principal',
  'manager',
  'director',
  'vp',
  'executive',
] as const
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number]

export const SENIORITY_META: Record<SeniorityLevel, { label: string; rank: number; typicalYears: number }> = {
  intern: { label: 'Intern', rank: 0, typicalYears: 0 },
  junior: { label: 'Junior', rank: 1, typicalYears: 1 },
  mid: { label: 'Mid-level', rank: 2, typicalYears: 3 },
  senior: { label: 'Senior', rank: 3, typicalYears: 6 },
  staff: { label: 'Staff', rank: 4, typicalYears: 9 },
  principal: { label: 'Principal', rank: 5, typicalYears: 12 },
  manager: { label: 'Manager', rank: 4, typicalYears: 8 },
  director: { label: 'Director', rank: 6, typicalYears: 12 },
  vp: { label: 'VP', rank: 7, typicalYears: 15 },
  executive: { label: 'Executive', rank: 8, typicalYears: 18 },
}

export const COMPANY_TYPES = [
  'Early-stage startup',
  'Growth-stage startup',
  'Public tech',
  'Enterprise',
  'Agency / Consultancy',
  'Non-profit',
  'Government',
] as const

export interface MasterProfile {
  id: 'master'
  /** Used to sign off drafted follow-ups. Never sent anywhere. */
  name?: string
  targetRoles: string[]
  seniority?: SeniorityLevel
  yearsExperience?: number
  skills: string[]
  tools: string[]
  domains: string[]
  industries: string[]
  companyTypes: string[]
  locations: string[]
  remotePreference: 'remote' | 'hybrid' | 'onsite' | 'flexible'
  willingToRelocate: boolean
  minCompensation?: number
  currency: string
  desiredKeywords: string[]
  undesiredKeywords: string[]
  updatedAt: Timestamp
}

/* -------------------------------------------------------------------------- */
/*  Workspace settings                                                         */
/* -------------------------------------------------------------------------- */

export interface WorkspaceSettings {
  id: 'workspace'
  /** An opportunity with no activity for this many days is "stale". */
  staleOpportunityDays: number
  /** A contact not touched for this many days needs a check-in. */
  staleContactDays: number
  /** Days after applying before a follow-up is suggested. */
  applicationFollowUpDays: number
  /** Days after an interview before a thank-you/follow-up is overdue. */
  interviewFollowUpDays: number
  weeklyApplicationTarget: number
  weeklyNetworkingTarget: number
  /** Set once the built-in message templates have been written. */
  templatesSeededAt?: Timestamp
  /**
   * When this workspace first existed on this device. Record dates cannot
   * stand in for it: the demo backdates everything it seeds, and an import
   * carries dates from wherever it came from.
   */
  workspaceStartedAt?: Timestamp
  /** Last time the workspace was exported, used for the backup reminder. */
  lastBackupAt?: Timestamp
  /** Last completed weekly review. */
  lastReviewAt?: Timestamp
  /** Built-in questions you have set aside as not applying to you. */
  hiddenQuestionIds?: string[]
  /** What you want from your next job, decided before an offer arrives. */
  decisionCriteria?: DecisionCriterion[]
  updatedAt: Timestamp
}

export const DEFAULT_SETTINGS: Omit<WorkspaceSettings, 'updatedAt'> = {
  id: 'workspace',
  staleOpportunityDays: 14,
  staleContactDays: 30,
  applicationFollowUpDays: 10,
  interviewFollowUpDays: 2,
  weeklyApplicationTarget: 5,
  weeklyNetworkingTarget: 3,
}

/* -------------------------------------------------------------------------- */
/*  Saved views                                                                */
/* -------------------------------------------------------------------------- */

export type SortDirection = 'asc' | 'desc'

export interface OpportunityFilters {
  query: string
  stages: Stage[]
  priorities: Priority[]
  arrangements: WorkArrangement[]
  tags: string[]
  sources: string[]
  locationQuery: string
  fitMin: number
  fitMax: number
  /** Filter by a date field within the last N days; null means no filter. */
  dateField: 'dateDiscovered' | 'dateApplied' | 'updatedAt'
  dateWithinDays: number | null
  archived: 'active' | 'archived' | 'all'
  hasNextAction: 'any' | 'yes' | 'no' | 'overdue'
}

export const EMPTY_FILTERS: OpportunityFilters = {
  query: '',
  stages: [],
  priorities: [],
  arrangements: [],
  tags: [],
  sources: [],
  locationQuery: '',
  fitMin: 0,
  fitMax: 100,
  dateField: 'dateDiscovered',
  dateWithinDays: null,
  archived: 'active',
  hasNextAction: 'any',
}

export type OpportunityColumnId =
  /** Company and role stacked in a single readable column. */
  | 'opportunity'
  | 'company'
  | 'role'
  | 'stage'
  | 'priority'
  | 'fit'
  | 'location'
  | 'arrangement'
  | 'compensation'
  | 'source'
  | 'tags'
  | 'nextAction'
  | 'nextActionDate'
  | 'dateDiscovered'
  | 'dateApplied'
  | 'updatedAt'

export interface SavedView {
  id: ID
  name: string
  /** Pinned views appear in the sidebar for one-click access. */
  pinned?: boolean
  filters: OpportunityFilters
  sortBy: OpportunityColumnId
  sortDir: SortDirection
  columns: OpportunityColumnId[]
  createdAt: Timestamp
}

/* -------------------------------------------------------------------------- */
/*  Export envelope                                                            */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Message templates                                                          */
/* -------------------------------------------------------------------------- */

export const TEMPLATE_CATEGORIES = [
  'application_follow_up',
  'interview_thank_you',
  'networking',
  'referral_request',
  'recruiter_reply',
  'offer',
  'other',
] as const
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

export const TEMPLATE_CATEGORY_META: Record<TemplateCategory, { label: string; hint: string }> = {
  application_follow_up: { label: 'Application follow-up', hint: 'Chasing an application that has gone quiet' },
  interview_thank_you: { label: 'After an interview', hint: 'Same-day note once an interview is done' },
  networking: { label: 'Networking', hint: 'Keeping a relationship warm' },
  referral_request: { label: 'Referral request', hint: 'Asking someone to refer you' },
  recruiter_reply: { label: 'Recruiter reply', hint: 'Responding to inbound interest' },
  offer: { label: 'Offer', hint: 'Negotiating or responding to an offer' },
  other: { label: 'Other', hint: 'Anything else you send often' },
}

export interface MessageTemplate {
  id: ID
  name: string
  category: TemplateCategory
  subject?: string
  body: string
  /** True for the templates shipped with the app; they remain fully editable. */
  builtIn: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/* -------------------------------------------------------------------------- */
/*  Restore points                                                             */
/* -------------------------------------------------------------------------- */

export const SNAPSHOT_REASONS = ['automatic', 'manual', 'before-restore', 'before-clear', 'before-demo'] as const
export type SnapshotReason = (typeof SNAPSHOT_REASONS)[number]

export const SNAPSHOT_REASON_LABEL: Record<SnapshotReason, string> = {
  automatic: 'Automatic',
  manual: 'Taken by you',
  'before-restore': 'Before a restore',
  'before-clear': 'Before clearing',
  'before-demo': 'Before loading the demo',
}

/**
 * A full copy of the workspace kept inside the browser. Exports protect against
 * losing the browser; restore points protect against losing the data inside it
 * — a bad import, an accidental clear, a mass edit you regret.
 */
export interface Snapshot {
  id: ID
  at: Timestamp
  reason: SnapshotReason
  counts: Record<string, number>
  /** Serialised `WorkspaceExport`, kept as a string so it is opaque to Dexie. */
  payload: string
  bytes: number
}

export const SCHEMA_VERSION = 4

export interface WorkspaceExport {
  format: 'opportunity-os.workspace'
  schemaVersion: number
  exportedAt: Timestamp
  appVersion: string
  counts: Record<string, number>
  data: {
    opportunities: Opportunity[]
    contacts: Contact[]
    interviews: Interview[]
    stories: Story[]
    events: ActivityEvent[]
    views: SavedView[]
    templates: MessageTemplate[]
    questions: CustomQuestion[]
    profile: MasterProfile | null
    settings: WorkspaceSettings | null
  }
}
