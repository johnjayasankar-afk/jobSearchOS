/**
 * The demo workspace.
 *
 * Every company and person here is fictional. Dates are generated relative to
 * the moment the workspace is created so the demo always shows overdue work,
 * upcoming interviews and a believable history — the same code paths the real
 * app uses, with no special-cased demo behaviour anywhere else in the product.
 */
import { db } from './db'
import { draftContact, draftInterview, draftOpportunity, draftStory, logEvent } from './repo'
import type {
  ActivityEvent,
  AnswerVerdict,
  Contact,
  DebriefRead,
  Interview,
  MasterProfile,
  Opportunity,
  Stage,
  Story,
} from './types'
import { addDays, newId, toDateOnly } from './utils'

const now = () => new Date()
const d = (offsetDays: number): string => toDateOnly(addDays(now(), offsetDays))
const iso = (offsetDays: number, hour = 10, minute = 0): string => {
  const date = addDays(now(), offsetDays)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const JD_PM_FINTECH = `Senior Product Manager, Payments Platform

Halcyon Pay is building the settlement infrastructure that modern fintechs run on. We move billions of dollars a year for platforms across North America and Europe.

About the role
You will own the merchant payouts experience end to end: ledgering, payout scheduling, reconciliation and the dashboards our customers live in. You will work with a team of 9 engineers, a designer and a data scientist.

Requirements
- 6+ years of product management experience, at least 3 in fintech or payments
- Strong SQL and comfort working directly with data; you write your own queries
- Experience with experimentation and A/B testing at scale
- Track record shipping B2B SaaS products to enterprise customers
- Excellent written communication and stakeholder management

Preferred qualifications
- Experience with ledger or double-entry accounting systems
- Familiarity with Looker or Amplitude
- Exposure to machine learning driven risk models

Compensation and location
Base salary range: $185,000 - $215,000 plus equity and bonus. This role is hybrid, 3 days per week in office in New York, NY.`

const JD_PM_AI = `Product Manager, AI Platform

Lumen Analytics helps data teams answer questions in plain language. Our AI platform team owns the retrieval, evaluation and orchestration layers behind every product surface.

What you'll do
- Define the roadmap for our evaluation and observability tooling
- Partner with research and engineering on model selection and prompt orchestration
- Build the analytics that tell us whether quality is improving

What we're looking for
- 5+ years of product management experience
- Hands-on experience with AI or machine learning products
- Strong analytical skills; SQL required, Python a plus
- Comfort with ambiguity and 0 to 1 product discovery

Nice to have
- Experience with developer tools or data infrastructure
- Background in experimentation and statistics

Location: Remote (US). Salary range $170,000 – $200,000 depending on experience.`

const JD_PM_HEALTH = `Group Product Manager, Care Navigation

Cobalt Health is a digital health company helping patients find the right care at the right time. We serve 4 million members through employer and payer partnerships.

Responsibilities
- Lead a team of three product managers across care navigation and scheduling
- Own outcomes for member engagement and cost of care
- Partner closely with clinical, operations and compliance stakeholders

Qualifications
- 8+ years in product management with at least 2 years managing product managers
- Healthcare experience strongly preferred
- Experience with regulated environments and HIPAA compliance
- Data-informed: you are fluent in analytics and experiment design

Location: Boston, MA. Hybrid, 2 days in office. Base $210,000 - $245,000.`

const JD_PM_MARKETPLACE = `Principal Product Manager, Marketplace Growth

Junction Retail runs one of the largest independent seller marketplaces in the country.

You will own buyer acquisition and activation. This is a growth role: heavy experimentation, funnel analysis and pricing work.

What you bring
- 9+ years of product experience with deep growth expertise
- Mastery of A/B testing, funnel analysis and retention modelling
- Fluency in SQL and comfort with Looker or Tableau
- E-commerce or marketplace background

This role is onsite in Austin, TX. $195,000 to $230,000 base.`

const JD_PM_DEVTOOLS = `Product Manager, Developer Experience

Terrace Software builds the deployment platform used by thousands of engineering teams.

Requirements
- 4+ years product management experience
- Technical background; you can read a pull request and hold your own in a design review
- Experience with developer tools, CI/CD or cloud infrastructure
- Familiarity with Kubernetes, Docker and observability tooling

Bonus points
- You have shipped a public API
- Experience with open source communities

Fully remote within the EU. €110,000 - €135,000.`

interface OppSpec {
  company: string
  role: string
  stage: Stage
  priority: 'high' | 'medium' | 'low'
  location: string
  arrangement: 'remote' | 'hybrid' | 'onsite'
  salaryMin?: number
  salaryMax?: number
  currency?: string
  source: string
  discovered: number
  applied?: number
  deadline?: number
  tags: string[]
  jd?: string
  nextAction?: string
  nextActionOffset?: number
  why?: string
  strengths?: string
  concerns?: string
  notes?: string
  archived?: boolean
  history: Array<[Stage, number]>
  rejection?: { offset: number; stage: Stage; reason: string }
  offer?: { offset: number; base: number; bonus?: number; equity?: string; deadlineOffset: number }
}

export const OPPORTUNITIES: OppSpec[] = [
  {
    company: 'Halcyon Pay',
    role: 'Senior Product Manager, Payments Platform',
    stage: 'onsite',
    priority: 'high',
    location: 'New York, NY',
    arrangement: 'hybrid',
    salaryMin: 185000,
    salaryMax: 215000,
    source: 'Referral',
    discovered: -38,
    applied: -33,
    tags: ['Fintech', 'B2B SaaS', 'Payments'],
    jd: JD_PM_FINTECH,
    nextAction: 'Send the payouts case study to Priya before the panel',
    nextActionOffset: -2,
    why: 'Closest thing to the ledger work I did at Meridian, and the team is small enough that I would own the whole surface.',
    strengths: 'Payments domain, SQL depth, and I already know two people on the team.',
    concerns: 'Hybrid three days a week is more office time than I want long term.',
    history: [
      ['saved', -38],
      ['evaluating', -37],
      ['applying', -35],
      ['applied', -33],
      ['recruiter_screen', -26],
      ['hiring_manager', -17],
      ['case_technical', -9],
      ['onsite', -3],
    ],
  },
  {
    company: 'Lumen Analytics',
    role: 'Product Manager, AI Platform',
    stage: 'final_round',
    priority: 'high',
    location: 'Remote (US)',
    arrangement: 'remote',
    salaryMin: 170000,
    salaryMax: 200000,
    source: 'LinkedIn',
    discovered: -45,
    applied: -41,
    tags: ['AI', 'Developer Tools', 'Analytics'],
    jd: JD_PM_AI,
    nextAction: 'Prepare the evaluation-tooling teardown for the final panel',
    nextActionOffset: 1,
    why: 'Evaluation tooling is exactly where I want to spend the next four years, and it is fully remote.',
    strengths: 'Shipped an internal eval harness at Meridian; strong SQL; the JD reads like my résumé.',
    concerns: 'Series B — I need to understand the runway before I sign anything.',
    history: [
      ['saved', -45],
      ['evaluating', -44],
      ['applied', -41],
      ['recruiter_screen', -34],
      ['hiring_manager', -25],
      ['case_technical', -12],
      ['final_round', -4],
    ],
  },
  {
    company: 'Cobalt Health',
    role: 'Group Product Manager, Care Navigation',
    stage: 'offer',
    priority: 'high',
    location: 'Boston, MA',
    arrangement: 'hybrid',
    salaryMin: 210000,
    salaryMax: 245000,
    source: 'Recruiter Outreach',
    discovered: -62,
    applied: -58,
    tags: ['Healthcare', 'Leadership'],
    jd: JD_PM_HEALTH,
    nextAction: 'Counter on base and ask for the equity refresh schedule',
    nextActionOffset: 0,
    why: 'First real people-management role, and the mission holds up.',
    strengths: 'Managed two PMs informally already; strong stakeholder track record.',
    concerns: 'Boston means relocating, and healthcare compliance will slow shipping.',
    offer: { offset: -5, base: 232000, bonus: 30000, equity: '0.08% over 4 years', deadlineOffset: 4 },
    history: [
      ['saved', -62],
      ['evaluating', -61],
      ['applied', -58],
      ['recruiter_screen', -50],
      ['hiring_manager', -42],
      ['onsite', -28],
      ['final_round', -14],
      ['offer', -5],
    ],
  },
  {
    company: 'Junction Retail',
    role: 'Principal Product Manager, Marketplace Growth',
    stage: 'recruiter_screen',
    priority: 'medium',
    location: 'Austin, TX',
    arrangement: 'onsite',
    salaryMin: 195000,
    salaryMax: 230000,
    source: 'Job Board',
    discovered: -21,
    applied: -18,
    tags: ['E-commerce', 'Growth'],
    jd: JD_PM_MARKETPLACE,
    why: 'Growth work at real scale. Worth a conversation even if Austin is a stretch.',
    concerns: 'Fully onsite in Austin and asks for 9+ years.',
    history: [
      ['saved', -21],
      ['applied', -18],
      ['recruiter_screen', -6],
    ],
  },
  {
    company: 'Terrace Software',
    role: 'Product Manager, Developer Experience',
    stage: 'recruiter_screen',
    priority: 'medium',
    location: 'Remote (EU)',
    arrangement: 'remote',
    salaryMin: 110000,
    salaryMax: 135000,
    currency: 'EUR',
    source: 'Company Site',
    discovered: -30,
    applied: -24,
    tags: ['Developer Tools', 'Remote'],
    jd: JD_PM_DEVTOOLS,
    why: 'Great product, but EU-based compensation is a real step down.',
    history: [
      ['saved', -30],
      ['evaluating', -28],
      ['applied', -24],
      ['recruiter_screen', -15],
    ],
  },
  {
    company: 'Vantage Grid',
    role: 'Senior Product Manager, Energy Markets',
    stage: 'hiring_manager',
    priority: 'high',
    location: 'Remote (US)',
    arrangement: 'remote',
    salaryMin: 175000,
    salaryMax: 205000,
    source: 'Network',
    discovered: -27,
    applied: -23,
    tags: ['Climate', 'Analytics'],
    nextAction: 'Send thank-you note to Dana and ask about the data team structure',
    nextActionOffset: -1,
    why: 'Climate work with a real data problem underneath it.',
    strengths: 'Heavy analytics background; the forecasting problem maps to my pricing work.',
    concerns: 'I know nothing about energy markets yet.',
    history: [
      ['saved', -27],
      ['applied', -23],
      ['recruiter_screen', -15],
      ['hiring_manager', -2],
    ],
  },
  {
    company: 'Brightpath Learning',
    role: 'Product Manager, Educator Tools',
    stage: 'applied',
    priority: 'low',
    location: 'Chicago, IL',
    arrangement: 'hybrid',
    salaryMin: 145000,
    salaryMax: 165000,
    source: 'LinkedIn',
    discovered: -34,
    applied: -31,
    tags: ['Education'],
    why: 'Mission is appealing, compensation is below my bar.',
    history: [
      ['saved', -34],
      ['applied', -31],
    ],
  },
  {
    company: 'Fernwood Robotics',
    role: 'Senior Product Manager, Fleet Software',
    stage: 'evaluating',
    priority: 'medium',
    location: 'Pittsburgh, PA',
    arrangement: 'onsite',
    salaryMin: 180000,
    salaryMax: 210000,
    source: 'Job Board',
    discovered: -12,
    deadline: 3,
    tags: ['Robotics', 'B2B SaaS'],
    why: 'Interesting hardware/software boundary, but onsite in Pittsburgh.',
    concerns: 'Would require relocating. Deadline is close.',
    history: [
      ['saved', -12],
      ['evaluating', -11],
    ],
  },
  {
    company: 'Sable Networks',
    role: 'Product Manager, Security Platform',
    stage: 'saved',
    priority: 'medium',
    location: 'Remote (US)',
    arrangement: 'remote',
    salaryMin: 165000,
    salaryMax: 190000,
    source: 'Job Board',
    discovered: -19,
    tags: ['Security'],
    notes: 'Found through the weekly newsletter. Need to read the JD properly.',
    history: [['saved', -19]],
  },
  {
    company: 'Adaptive Foundry',
    role: 'Staff Product Manager, ML Infrastructure',
    stage: 'saved',
    priority: 'high',
    location: 'San Francisco, CA',
    arrangement: 'hybrid',
    salaryMin: 210000,
    salaryMax: 250000,
    source: 'Referral',
    discovered: -4,
    deadline: 9,
    tags: ['AI', 'Data Infrastructure'],
    why: 'Marcus offered to refer me. Strongest technical team on this list.',
    history: [['saved', -4]],
  },
  {
    company: 'Quillmark',
    role: 'Product Manager, Content Workflows',
    stage: 'applying',
    priority: 'medium',
    location: 'Remote (US)',
    arrangement: 'remote',
    salaryMin: 155000,
    salaryMax: 180000,
    source: 'Company Site',
    discovered: -8,
    deadline: 2,
    tags: ['B2B SaaS', 'Media'],
    nextAction: 'Finish the cover letter and submit',
    nextActionOffset: 0,
    history: [
      ['saved', -8],
      ['evaluating', -7],
      ['applying', -2],
    ],
  },
  {
    company: 'Ridgeline Freight',
    role: 'Senior Product Manager, Carrier Network',
    stage: 'rejected',
    priority: 'medium',
    location: 'Denver, CO',
    arrangement: 'hybrid',
    salaryMin: 170000,
    salaryMax: 195000,
    source: 'LinkedIn',
    discovered: -70,
    applied: -66,
    tags: ['Logistics'],
    rejection: { offset: -40, stage: 'hiring_manager', reason: 'Went with a candidate who had freight domain experience' },
    history: [
      ['saved', -70],
      ['applied', -66],
      ['recruiter_screen', -58],
      ['hiring_manager', -47],
      ['rejected', -40],
    ],
  },
  {
    company: 'Solstice Bio',
    role: 'Product Manager, Lab Operations',
    stage: 'rejected',
    priority: 'low',
    location: 'Cambridge, MA',
    arrangement: 'onsite',
    salaryMin: 150000,
    salaryMax: 175000,
    source: 'Job Board',
    discovered: -55,
    applied: -52,
    tags: ['Biotech'],
    rejection: { offset: -44, stage: 'applied', reason: 'No response after eight weeks; treated as closed' },
    history: [
      ['saved', -55],
      ['applied', -52],
      ['rejected', -44],
    ],
  },
  {
    company: 'Marlowe & Finch',
    role: 'Product Lead, Wealth Platform',
    stage: 'withdrawn',
    priority: 'low',
    location: 'New York, NY',
    arrangement: 'onsite',
    salaryMin: 160000,
    salaryMax: 185000,
    source: 'Recruiter Outreach',
    discovered: -48,
    applied: -45,
    tags: ['Fintech'],
    notes: 'Withdrew after the second call — five days a week in office and the team had turned over twice in a year.',
    history: [
      ['saved', -48],
      ['applied', -45],
      ['recruiter_screen', -38],
      ['withdrawn', -35],
    ],
  },
  {
    company: 'Kestrel Analytics',
    role: 'Senior Product Manager, Reporting',
    stage: 'rejected',
    priority: 'medium',
    location: 'Chicago, IL',
    arrangement: 'hybrid',
    salaryMin: 165000,
    salaryMax: 190000,
    source: 'Referral',
    discovered: -62,
    applied: -59,
    tags: ['Analytics'],
    rejection: { offset: -33, stage: 'hiring_manager', reason: 'Wanted someone who had run a reporting rebuild end to end' },
    history: [
      ['saved', -62],
      ['applied', -59],
      ['recruiter_screen', -50],
      ['hiring_manager', -41],
      ['rejected', -33],
    ],
  },
  {
    company: 'Northwind Labs',
    role: 'Product Manager, Data Products',
    stage: 'saved',
    priority: 'low',
    location: 'Seattle, WA',
    arrangement: 'hybrid',
    salaryMin: 150000,
    salaryMax: 175000,
    source: 'Job Board',
    discovered: -90,
    tags: ['Analytics'],
    archived: true,
    notes: 'Archived — the posting was pulled down.',
    history: [['saved', -90]],
  },
]

interface ContactSpec {
  name: string
  company: string
  title: string
  relationship: Contact['relationship']
  email?: string
  linkedin?: string
  opportunities: string[]
  lastContact?: number
  nextFollowUp?: number
  notes?: string
  tags?: string[]
}

const CONTACTS: ContactSpec[] = [
  {
    name: 'Priya Raghavan',
    company: 'Halcyon Pay',
    title: 'Director of Product',
    relationship: 'hiring_manager',
    email: 'priya.raghavan@halcyonpay.example',
    opportunities: ['Halcyon Pay'],
    lastContact: -3,
    nextFollowUp: -1,
    notes: 'Runs the payouts org. Wants the case study before the panel. Direct, appreciates specifics over narrative.',
    tags: ['Decision maker'],
  },
  {
    name: 'Dana Okonkwo',
    company: 'Vantage Grid',
    title: 'VP Product',
    relationship: 'hiring_manager',
    email: 'dana.o@vantagegrid.example',
    opportunities: ['Vantage Grid'],
    lastContact: -2,
    nextFollowUp: 0,
    notes: 'Asked good questions about how I handle ambiguous data. Mentioned the data team is being restructured.',
  },
  {
    name: 'Marcus Delgado',
    company: 'Adaptive Foundry',
    title: 'Staff Engineer',
    relationship: 'referral',
    email: 'marcus.delgado@example.com',
    opportunities: ['Adaptive Foundry'],
    lastContact: -5,
    nextFollowUp: 1,
    notes: 'Former colleague at Meridian. Offered to refer me for the ML infra role — needs my résumé by Friday.',
    tags: ['Warm'],
  },
  {
    name: 'Elena Whitcombe',
    company: 'Lumen Analytics',
    title: 'Technical Recruiter',
    relationship: 'recruiter',
    email: 'elena.w@lumenanalytics.example',
    opportunities: ['Lumen Analytics'],
    lastContact: -4,
    nextFollowUp: 2,
    notes: 'Coordinating the final panel. Confirmed the range tops out at 200k base.',
  },
  {
    name: 'Tobias Lindqvist',
    company: 'Cobalt Health',
    title: 'Talent Partner',
    relationship: 'recruiter',
    email: 'tobias.l@cobalthealth.example',
    opportunities: ['Cobalt Health'],
    lastContact: -5,
    nextFollowUp: 1,
    notes: 'Sent the offer letter. Said there is room on base but equity is fixed by band.',
  },
  {
    name: 'Nadia Ferreira',
    company: 'Junction Retail',
    title: 'Senior Recruiter',
    relationship: 'recruiter',
    opportunities: ['Junction Retail'],
    lastContact: -6,
    notes: 'Screening call went fine. Flagged that the team strongly prefers onsite.',
  },
  {
    name: 'Grace Ahn',
    company: 'Meridian Systems',
    title: 'Principal PM',
    relationship: 'friend',
    email: 'grace.ahn@example.com',
    opportunities: [],
    lastContact: -41,
    notes: 'Former manager. Best reference I have. Should not let this go quiet.',
    tags: ['Reference'],
  },
  {
    name: 'Samuel Iyer',
    company: 'Terrace Software',
    title: 'Engineering Manager',
    relationship: 'employee',
    opportunities: ['Terrace Software'],
    lastContact: -36,
    notes: 'Met at a conference. Said he would flag my application internally — no confirmation yet.',
  },
  {
    name: 'Beatriz Moraes',
    company: 'Cedar & Vale',
    title: 'Partner',
    relationship: 'investor',
    opportunities: [],
    lastContact: -52,
    notes: 'Seed investor across three portfolio companies hiring senior PMs. Worth a quarterly check-in.',
    tags: ['Network'],
  },
  {
    name: 'Owen Barclay',
    company: 'Fernwood Robotics',
    title: 'Head of Product',
    relationship: 'alumni',
    linkedin: 'https://www.linkedin.com/in/example-owen-barclay',
    opportunities: ['Fernwood Robotics'],
    lastContact: -14,
    nextFollowUp: 3,
    notes: 'Same university programme. Happy to give an honest read on the team before I apply.',
  },
]

const STORIES: Array<Partial<Story> & { title: string }> = [
  {
    title: 'Rebuilt the payouts ledger without downtime',
    situation:
      'Meridian processed merchant payouts on a ledger that had been patched for six years. Reconciliation broke roughly twice a month and finance spent four days closing each period.',
    task: 'I owned the decision on whether to keep patching or rebuild, and the plan to do it without a payment freeze.',
    action:
      'I mapped every write path with two engineers, then proposed a dual-write migration with a shadow ledger running for eight weeks. I negotiated a two-quarter roadmap slip with the CFO by showing the cost of the recurring breakages in finance hours.',
    result:
      'We cut over with zero missed payouts. Reconciliation breaks went to zero for the following nine months and the finance close dropped from four days to under one.',
    metrics: 'Close time 4 days → 0.8 days; reconciliation incidents 2/month → 0',
    skills: ['Product Strategy', 'Stakeholder Management', 'SQL'],
    tags: ['Execution', 'Technical', 'Stakeholders'],
    favorite: true,
    useCount: 6,
  },
  {
    title: 'Killed my own feature after the data disagreed',
    situation:
      'I had championed a smart-scheduling feature for six months. It shipped to 15% of merchants and the early qualitative feedback was glowing.',
    task: 'Decide whether to roll it out fully ahead of a board update where I had already promised it.',
    action:
      'I ran the retention cut properly instead of reading the highlight reel. Treated merchants were 4% *less* likely to be active at day 60. I wrote a one-page memo recommending we kill it, presented it to the exec team myself, and proposed the two experiments that would have caught it sooner.',
    result:
      'We killed the feature and reclaimed a quarter of engineering capacity. The pre-registration process I wrote became the standard for every experiment on the team.',
    metrics: 'Recovered ~1 quarter of team capacity; experiment pre-registration adopted org-wide',
    skills: ['A/B Testing', 'Data Analysis', 'Product Analytics'],
    tags: ['Failure', 'Analytics', 'Execution'],
    favorite: true,
    useCount: 4,
  },
  {
    title: 'Took the risk-scoring product from zero to first revenue',
    situation:
      'Merchants kept asking for fraud controls we did not have. There was no team, no budget and no clear buyer inside the company.',
    task: 'Prove there was a product before asking for headcount.',
    action:
      'I interviewed 22 merchants in three weeks and found the real job was chargeback triage, not fraud prevention. I built a spreadsheet-driven concierge version and ran it manually for nine merchants for a month.',
    result:
      'Three merchants signed paid pilots off the manual version. That funded a four-person team, and the product reached $1.2M ARR in its first year.',
    metrics: '9 concierge pilots → 3 paid → $1.2M ARR in year one',
    skills: ['Product Discovery', 'User Research', 'Go-to-Market'],
    tags: ['0→1', 'Growth', 'Strategy'],
    favorite: true,
    useCount: 5,
  },
  {
    title: 'Resolved a two-quarter standoff with the platform team',
    situation:
      'My roadmap depended on an API the platform team had deprioritised twice. Both teams had escalated to their VPs and neither would move.',
    task: 'Unblock the dependency without another escalation.',
    action:
      'I sat with the platform lead and learned their real constraint was on-call load, not priorities. I offered to take first-line support for the endpoints my team consumed and wrote the runbook myself.',
    result:
      'The API shipped the following sprint. The support-sharing arrangement was adopted by two other teams.',
    metrics: 'Unblocked a 2-quarter dependency in 3 weeks',
    skills: ['Stakeholder Management', 'Prioritization'],
    tags: ['Conflict', 'Stakeholders', 'Leadership'],
    useCount: 3,
  },
  {
    title: 'Grew activation 31% by deleting steps',
    situation: 'Merchant activation had been flat at 38% for three quarters despite a steady stream of onboarding features.',
    task: 'Find the actual constraint rather than adding another tooltip.',
    action:
      'I watched 15 recorded sessions and found most drop-off happened at a bank-verification step we had inherited from a compliance requirement that no longer applied. I got legal sign-off to remove it and ran the change as a proper A/B test.',
    result: 'Activation went from 38% to 49.7% and held for two quarters. Support tickets about verification fell by two thirds.',
    metrics: 'Activation 38% → 49.7%; verification tickets −66%',
    skills: ['Growth', 'A/B Testing', 'User Research'],
    tags: ['Growth', 'Analytics', 'Execution'],
    useCount: 4,
  },
  {
    title: 'Shipped an evaluation harness before shipping the model',
    situation:
      'The team wanted to launch an LLM-powered summary feature. Nobody could answer how we would know if it got worse after launch.',
    task: 'Make quality measurable before committing to the release.',
    action:
      'I blocked the launch for three weeks and built a golden set of 400 labelled examples with two engineers, plus a nightly eval job and a quality dashboard. I defined the regression threshold that would block a deploy.',
    result:
      'The eval caught a 9-point quality regression from a prompt change two weeks after launch, before any customer reported it. The harness became the template for three other AI features.',
    metrics: 'Caught a 9-point regression pre-customer; template reused by 3 teams',
    skills: ['Machine Learning', 'Experiment Design', 'Product Analytics'],
    tags: ['AI', 'Technical', 'Execution'],
    favorite: true,
    useCount: 2,
  },
  {
    title: 'Rebuilt a team that had lost three PMs in a year',
    situation: 'I inherited a two-person product team with a reputation for missing commitments and high attrition.',
    task: 'Stabilise the team and re-earn engineering trust within two quarters.',
    action:
      'I stopped all new commitments for six weeks, published a single prioritised list, and instituted a weekly written update that named what slipped and why. I coached both PMs on writing decision memos and moved one of them onto work that matched their strengths.',
    result: 'Both PMs stayed and one was promoted. On-time delivery went from 45% to 82% over two quarters.',
    metrics: 'On-time delivery 45% → 82%; zero attrition over 4 quarters',
    skills: ['People Management', 'Mentorship', 'Prioritization'],
    tags: ['Leadership', 'Execution'],
    useCount: 2,
  },
  {
    title: 'Made the case for a price increase nobody wanted to make',
    situation: 'We had not changed pricing in four years while the product had roughly tripled in scope.',
    task: 'Build the case for a change that sales, support and the CEO were all nervous about.',
    action:
      'I modelled five pricing scenarios against two years of usage data, ran a willingness-to-pay survey with 180 customers, and proposed grandfathering existing accounts for twelve months. I presented the downside case first.',
    result: 'The new pricing lifted new-business ARPU 24% with churn unchanged over the following two quarters.',
    metrics: 'New-business ARPU +24%; churn flat',
    skills: ['Pricing', 'Financial Modeling', 'Storytelling'],
    tags: ['Strategy', 'Analytics', 'Stakeholders'],
    useCount: 3,
  },
]

const DEMO_PROFILE: Omit<MasterProfile, 'updatedAt'> = {
  id: 'master',
  targetRoles: ['Senior Product Manager', 'Group Product Manager', 'Principal Product Manager'],
  seniority: 'senior',
  yearsExperience: 8,
  skills: [
    'Product Strategy',
    'Product Discovery',
    'A/B Testing',
    'SQL',
    'Product Analytics',
    'Stakeholder Management',
    'Roadmapping',
    'Pricing',
    'Growth',
    'User Research',
  ],
  tools: ['Amplitude', 'Looker', 'Figma', 'Linear', 'dbt'],
  domains: ['Fintech', 'AI', 'B2B SaaS', 'Analytics'],
  industries: ['Fintech', 'Developer Tools'],
  companyTypes: ['Growth-stage startup', 'Public tech'],
  locations: ['New York, NY', 'Remote'],
  remotePreference: 'remote',
  willingToRelocate: false,
  minCompensation: 180000,
  currency: 'USD',
  desiredKeywords: ['platform', 'experimentation', 'ledger', '0 to 1'],
  undesiredKeywords: ['on-call rotation', 'five days in office'],
}

/**
 * Writes the demo workspace. The caller is responsible for confirming that an
 * existing workspace may be replaced.
 */
export async function seedDemoWorkspace(): Promise<{ counts: Record<string, number> }> {
  const opportunities: Opportunity[] = []
  const byCompany = new Map<string, Opportunity>()

  for (const spec of OPPORTUNITIES) {
    const createdAt = iso(spec.discovered, 9, 15)
    const lastHistory = spec.history[spec.history.length - 1]
    const record = draftOpportunity({
      company: spec.company,
      role: spec.role,
      jobUrl: `https://careers.${spec.company.toLowerCase().replace(/[^a-z]/g, '')}.example/jobs/${newId().slice(-6)}`,
      location: spec.location,
      workArrangement: spec.arrangement,
      salaryMin: spec.salaryMin,
      salaryMax: spec.salaryMax,
      currency: spec.currency ?? 'USD',
      source: spec.source,
      dateDiscovered: d(spec.discovered),
      dateApplied: spec.applied === undefined ? undefined : d(spec.applied),
      deadline: spec.deadline === undefined ? undefined : d(spec.deadline),
      stage: spec.stage,
      priority: spec.priority,
      jobDescription: spec.jd,
      whyInterested: spec.why,
      strengths: spec.strengths,
      concerns: spec.concerns,
      notes: spec.notes,
      tags: spec.tags,
      nextAction: spec.nextAction,
      nextActionDate: spec.nextActionOffset === undefined ? undefined : d(spec.nextActionOffset),
      interestScore: spec.priority === 'high' ? 5 : spec.priority === 'medium' ? 3 : 2,
      createdAt,
      updatedAt: iso(lastHistory ? lastHistory[1] : spec.discovered, 16, 40),
      stageChangedAt: iso(lastHistory ? lastHistory[1] : spec.discovered, 16, 40),
      stageHistory: spec.history.map(([stage, offset]) => ({ stage, at: iso(offset, 11, 0) })),
      archivedAt: spec.archived ? iso(-2, 12, 0) : undefined,
      rejection: spec.rejection
        ? { date: d(spec.rejection.offset), stage: spec.rejection.stage, reason: spec.rejection.reason }
        : undefined,
      offer: spec.offer
        ? {
            date: d(spec.offer.offset),
            baseSalary: spec.offer.base,
            bonus: spec.offer.bonus,
            equity: spec.offer.equity,
            currency: 'USD',
            decisionDeadline: d(spec.offer.deadlineOffset),
            status: 'negotiating',
          }
        : undefined,
    })
    opportunities.push(record)
    byCompany.set(spec.company, record)
  }

  const contacts: Contact[] = CONTACTS.map((spec) =>
    draftContact({
      name: spec.name,
      company: spec.company,
      title: spec.title,
      relationship: spec.relationship,
      email: spec.email,
      linkedinUrl: spec.linkedin,
      opportunityIds: spec.opportunities
        .map((company) => byCompany.get(company)?.id)
        .filter((id): id is string => Boolean(id)),
      lastContactDate: spec.lastContact === undefined ? undefined : d(spec.lastContact),
      nextFollowUpDate: spec.nextFollowUp === undefined ? undefined : d(spec.nextFollowUp),
      notes: spec.notes,
      tags: spec.tags ?? [],
      createdAt: iso(spec.lastContact ?? -30, 9, 0),
    }),
  )

  const stories: Story[] = STORIES.map((s, i) =>
    draftStory({
      ...s,
      lastUsedAt: i < 4 ? iso(-3 - i * 6, 15, 0) : undefined,
      createdAt: iso(-80 + i * 6, 20, 0),
    }),
  )

  const contactByName = new Map(contacts.map((c) => [c.name, c]))
  const storyByTitle = new Map(stories.map((s) => [s.title, s]))

  const interviews: Interview[] = []
  const pushInterview = (spec: {
    company: string
    offsetDays: number
    hour: number
    type: Interview['type']
    format?: Interview['format']
    contact?: string
    stories?: string[]
    prep?: string
    expected?: string[]
    ask?: string[]
    doneCount?: number
    outcome?: Interview['outcome']
    followUpSent?: boolean
    debrief?: string
    asked?: Array<{ id?: string; text?: string; verdict: AnswerVerdict }>
    read?: DebriefRead
  }) => {
    const opp = byCompany.get(spec.company)
    if (!opp) return
    const contact = spec.contact ? contactByName.get(spec.contact) : undefined
    const checklist = [
      'Re-read the job description',
      'Research the interviewer',
      'Prepare 3 relevant stories',
      'Prepare questions to ask',
      'Confirm logistics and time zone',
    ].map((text, i) => ({ id: newId('ck_'), text, done: i < (spec.doneCount ?? 0) }))

    interviews.push(
      draftInterview({
        opportunityId: opp.id,
        scheduledAt: iso(spec.offsetDays, spec.hour, 0),
        durationMinutes: spec.type === 'recruiter' ? 30 : 60,
        type: spec.type,
        format: spec.format ?? 'video',
        contactIds: contact ? [contact.id] : [],
        interviewers: contact ? undefined : 'Panel — names not confirmed',
        prepNotes: spec.prep,
        questionsExpected: spec.expected ?? [],
        questionsToAsk: spec.ask ?? [],
        checklist,
        storyIds: (spec.stories ?? [])
          .map((t) => storyByTitle.get(t)?.id)
          .filter((id): id is string => Boolean(id)),
        outcome: spec.outcome ?? 'pending',
        debrief: spec.debrief,
        debriefedAt: spec.asked ? iso(spec.offsetDays, spec.hour + 2, 0) : undefined,
        askedQuestions: spec.asked?.map((a) => ({
          questionId: a.id,
          text: a.text,
          verdict: a.verdict,
        })),
        debriefRead: spec.read,
        followUpSent: spec.followUpSent ?? false,
        createdAt: iso(spec.offsetDays - 6, 9, 0),
      }),
    )
  }

  pushInterview({
    company: 'Halcyon Pay',
    offsetDays: 1,
    hour: 14,
    type: 'panel',
    contact: 'Priya Raghavan',
    stories: ['Rebuilt the payouts ledger without downtime', 'Grew activation 31% by deleting steps'],
    prep: 'Four back-to-back sessions: product sense, execution, a data deep-dive and values. Priya said the data round will use their real reconciliation dataset.',
    expected: [
      'Walk me through a payments product you owned end to end.',
      'How would you decide whether to rebuild or patch a legacy ledger?',
      'Tell me about a time you disagreed with an engineering lead.',
    ],
    ask: [
      'How is the payouts roadmap split between platform and merchant-facing work?',
      'What happened to the last person in this role?',
      'How does the team decide what not to build?',
    ],
    doneCount: 2,
  })
  pushInterview({
    company: 'Lumen Analytics',
    offsetDays: 3,
    hour: 11,
    type: 'product_sense',
    contact: 'Elena Whitcombe',
    stories: ['Shipped an evaluation harness before shipping the model'],
    prep: 'Final round. 45 minutes with the CPO on product sense, then 45 on the eval-tooling teardown they asked me to prepare.',
    expected: ['How would you improve our evaluation tooling?', 'How do you measure quality for an AI feature?'],
    ask: ['How long is the runway after the Series B?', 'Who owns model selection today?'],
    doneCount: 1,
  })
  pushInterview({
    company: 'Vantage Grid',
    offsetDays: -2,
    hour: 15,
    type: 'hiring_manager',
    contact: 'Dana Okonkwo',
    stories: ['Killed my own feature after the data disagreed'],
    prep: 'Dana wanted to talk through how I handle problems where the data is genuinely thin.',
    outcome: 'pending',
    followUpSent: false,
    debrief: 'Went well. She spent 20 minutes on the data team restructure, which felt like a real concern on her side.',
    doneCount: 5,
  })
  pushInterview({
    company: 'Junction Retail',
    offsetDays: -6,
    hour: 10,
    type: 'recruiter',
    contact: 'Nadia Ferreira',
    prep: 'Standard screen. Confirm the range and how firm the onsite requirement is.',
    outcome: 'advanced',
    followUpSent: true,
    debrief: 'Range confirmed at 195–230. Onsite is non-negotiable — five days initially, four after ramp.',
    read: 'mixed',
    asked: [
      { id: 'exec-complex', verdict: 'ok' },
      { text: 'Why are you leaving your current role?', verdict: 'ok' },
      { text: 'What are you looking for in your next team?', verdict: 'well' },
    ],
    doneCount: 5,
  })
  pushInterview({
    company: 'Cobalt Health',
    offsetDays: -14,
    hour: 13,
    type: 'panel',
    contact: 'Tobias Lindqvist',
    stories: ['Rebuilt a team that had lost three PMs in a year'],
    prep: 'Final round: two PMs, the clinical lead and the CPO.',
    outcome: 'advanced',
    followUpSent: true,
    debrief: 'Strong. The clinical lead pushed hard on regulatory constraints — my answer about compliance-as-a-design-input landed.',
    read: 'strong',
    asked: [
      { id: 'stake-skeptical', verdict: 'well' },
      { id: 'conflict-teams', verdict: 'well' },
      { id: 'exec-complex', verdict: 'ok' },
      { id: 'lead-developed', verdict: 'badly' },
      { text: 'How do you work with clinical safety reviewers?', verdict: 'ok' },
    ],
    doneCount: 5,
  })

  // Every real search has one of these: a screen you sat, never heard back
  // about, and did not chase because you were not excited enough.
  pushInterview({
    company: 'Terrace Software',
    offsetDays: -15,
    hour: 16,
    type: 'recruiter',
    prep: 'Remote-first, EU contract. Find out whether the band flexes for a senior hire.',
    outcome: 'pending',
    followUpSent: true,
    doneCount: 4,
  })
  pushInterview({
    company: 'Ridgeline Freight',
    offsetDays: -58,
    hour: 11,
    type: 'recruiter',
    prep: 'Confirm the range and how much freight domain knowledge they expect.',
    outcome: 'advanced',
    followUpSent: true,
    doneCount: 5,
  })
  pushInterview({
    company: 'Ridgeline Freight',
    offsetDays: -47,
    hour: 15,
    type: 'hiring_manager',
    prep: 'He runs carrier ops. Expect a lot on prioritising against operational pain.',
    outcome: 'rejected',
    followUpSent: true,
    debrief: 'Fine until he asked how I would sequence a network rebuild. I described the outcome, not the sequence, and he pushed twice.',
    read: 'mixed',
    asked: [
      { id: 'exec-complex', verdict: 'ok' },
      { id: 'strategy-not-do', verdict: 'badly' },
      { id: 'lead-without-authority', verdict: 'ok' },
      { text: 'How would you sequence a carrier network rebuild?', verdict: 'badly' },
    ],
    doneCount: 5,
  })
  pushInterview({
    company: 'Kestrel Analytics',
    offsetDays: -50,
    hour: 10,
    type: 'recruiter',
    prep: 'Referral from Beatriz. Confirm scope — is this the reporting rebuild or BAU?',
    outcome: 'advanced',
    followUpSent: true,
    doneCount: 5,
  })
  pushInterview({
    company: 'Kestrel Analytics',
    offsetDays: -41,
    hour: 14,
    type: 'hiring_manager',
    prep: 'She owns the reporting platform. Be concrete about the migration I ran.',
    outcome: 'rejected',
    followUpSent: true,
    debrief: 'She wanted end-to-end ownership of a rebuild and I have only run one phase of one. Fair. Worth writing that story properly.',
    read: 'weak',
    asked: [
      { id: 'exec-complex', verdict: 'badly' },
      { id: 'analytics-defined-metric', verdict: 'well' },
      { id: 'strategy-not-do', verdict: 'badly' },
    ],
    doneCount: 5,
  })
  pushInterview({
    company: 'Marlowe & Finch',
    offsetDays: -38,
    hour: 9,
    type: 'recruiter',
    prep: 'Recruiter outreach. Find out how fixed the five-days-in-office line is.',
    outcome: 'advanced',
    followUpSent: true,
    doneCount: 5,
  })

  const events: ActivityEvent[] = []
  const addEvent = (e: Omit<ActivityEvent, 'id'>) => events.push({ id: newId('ev_'), ...e })

  for (const [i, spec] of OPPORTUNITIES.entries()) {
    const opp = opportunities[i]
    if (!opp) continue
    addEvent({
      at: iso(spec.discovered, 9, 15),
      type: 'opportunity_created',
      opportunityId: opp.id,
      summary: `Added ${opp.role} at ${opp.company}`,
      detail: `Source: ${spec.source}`,
    })
    for (let h = 1; h < spec.history.length; h++) {
      const prev = spec.history[h - 1]
      const cur = spec.history[h]
      if (!prev || !cur) continue
      addEvent({
        at: iso(cur[1], 11, 0),
        type: cur[0] === 'rejected' ? 'rejected' : cur[0] === 'withdrawn' ? 'withdrawn' : 'stage_changed',
        opportunityId: opp.id,
        summary: `${labelOf(prev[0])} → ${labelOf(cur[0])}`,
      })
      if (cur[0] === 'applied') {
        addEvent({
          at: iso(cur[1], 11, 5),
          type: 'applied',
          opportunityId: opp.id,
          summary: `Applied to ${opp.company}`,
        })
      }
    }
    if (spec.offer) {
      addEvent({
        at: iso(spec.offer.offset, 16, 30),
        type: 'offer_recorded',
        opportunityId: opp.id,
        summary: 'Offer recorded',
        detail: `Base $${spec.offer.base.toLocaleString()}`,
      })
    }
    if (spec.archived) {
      addEvent({ at: iso(-2, 12, 0), type: 'archived', opportunityId: opp.id, summary: 'Archived' })
    }
  }

  for (const [i, spec] of CONTACTS.entries()) {
    const contact = contacts[i]
    if (!contact) continue
    addEvent({
      at: iso(spec.lastContact ?? -30, 9, 30),
      type: 'contact_linked',
      contactId: contact.id,
      opportunityId: contact.opportunityIds[0],
      summary: `Added contact ${contact.name}${contact.company ? ` (${contact.company})` : ''}`,
    })
    if (spec.lastContact !== undefined) {
      addEvent({
        at: iso(spec.lastContact, 14, 10),
        type: 'contact_logged',
        contactId: contact.id,
        opportunityId: contact.opportunityIds[0],
        summary: `Reached out to ${contact.name}`,
      })
    }
  }

  for (const iv of interviews) {
    const opp = opportunities.find((o) => o.id === iv.opportunityId)
    addEvent({
      at: iv.createdAt,
      type: 'interview_created',
      opportunityId: iv.opportunityId,
      interviewId: iv.id,
      summary: `Scheduled ${iv.type.replace(/_/g, ' ')} interview${opp ? ` with ${opp.company}` : ''}`,
    })
    if (iv.outcome !== 'pending') {
      addEvent({
        at: iv.scheduledAt,
        type: 'interview_result',
        opportunityId: iv.opportunityId,
        interviewId: iv.id,
        summary: `Interview outcome: ${iv.outcome.replace(/_/g, ' ')}`,
      })
    }
  }

  events.sort((a, b) => a.at.localeCompare(b.at))

  await db.transaction(
    'rw',
    [db.opportunities, db.contacts, db.interviews, db.stories, db.events, db.views, db.profile, db.settings],
    async () => {
      await db.opportunities.bulkPut(opportunities)
      await db.contacts.bulkPut(contacts)
      await db.stories.bulkPut(stories)
      await db.interviews.bulkPut(interviews)
      await db.events.bulkPut(events)
      await db.profile.put({ ...DEMO_PROFILE, updatedAt: new Date().toISOString() })
    },
  )

  return {
    counts: {
      opportunities: opportunities.length,
      contacts: contacts.length,
      interviews: interviews.length,
      stories: stories.length,
      events: events.length,
    },
  }
}

function labelOf(stage: Stage): string {
  return stage
    .split('_')
    .map((w) => (w[0] ?? '').toUpperCase() + w.slice(1))
    .join(' ')
}

export { logEvent }
