/**
 * Message templates and variable substitution.
 *
 * Opportunity OS never sends anything. This turns what you already know about a
 * contact, a role and an interview into a draft you can read, edit and copy —
 * the part of a follow-up that actually costs time. Substitution is a plain
 * `{{variable}}` replace; nothing is generated.
 */
import {
  INTERVIEW_TYPE_META,
  STAGE_META,
  type Contact,
  type Interview,
  type MasterProfile,
  type MessageTemplate,
  type Opportunity,
  type TemplateCategory,
} from './types'
import { daysSince, formatDate, newId, nowIso } from './utils'

/* ------------------------------- variables -------------------------------- */

export interface TemplateVariable {
  token: string
  label: string
  /** Shown in the composer when a value cannot be filled in. */
  requires: string
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { token: 'first_name', label: "Contact's first name", requires: 'a linked contact' },
  { token: 'full_name', label: "Contact's full name", requires: 'a linked contact' },
  { token: 'their_title', label: "Contact's job title", requires: 'a contact with a title' },
  { token: 'company', label: 'Company', requires: 'a linked opportunity' },
  { token: 'role', label: 'Role title', requires: 'a linked opportunity' },
  { token: 'stage', label: 'Current stage', requires: 'a linked opportunity' },
  { token: 'applied_date', label: 'Date you applied', requires: 'an application date' },
  { token: 'days_since_applied', label: 'Days since you applied', requires: 'an application date' },
  { token: 'interview_type', label: 'Interview type', requires: 'a linked interview' },
  { token: 'interview_date', label: 'Interview date', requires: 'a linked interview' },
  { token: 'my_name', label: 'Your name', requires: 'your name in the Master Profile' },
]

export interface TemplateContext {
  contact?: Contact
  opportunity?: Opportunity
  interview?: Interview
  profile?: MasterProfile | null
}

export interface RenderedTemplate {
  subject: string
  body: string
  /** Tokens that had no value; the composer surfaces these before you copy. */
  missing: TemplateVariable[]
  /** Tokens in the template that are not part of the vocabulary. */
  unknown: string[]
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

function valuesFor(ctx: TemplateContext): Record<string, string | undefined> {
  const { contact, opportunity, interview, profile } = ctx
  const since = daysSince(opportunity?.dateApplied)
  return {
    first_name: contact ? firstNameOf(contact.name) : undefined,
    full_name: contact?.name,
    their_title: contact?.title,
    company: opportunity?.company ?? contact?.company,
    role: opportunity?.role,
    stage: opportunity ? STAGE_META[opportunity.stage].label.toLowerCase() : undefined,
    applied_date: opportunity?.dateApplied ? formatDate(opportunity.dateApplied) : undefined,
    days_since_applied: since === null || since === undefined ? undefined : String(since),
    interview_type: interview ? INTERVIEW_TYPE_META[interview.type].label.toLowerCase() : undefined,
    interview_date: interview ? formatDate(interview.scheduledAt) : undefined,
    my_name: profile?.name,
  }
}

const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/g

export function renderTemplate(template: MessageTemplate, ctx: TemplateContext): RenderedTemplate {
  const values = valuesFor(ctx)
  const missing = new Map<string, TemplateVariable>()
  const unknown = new Set<string>()

  const substitute = (text: string): string =>
    text.replace(TOKEN_RE, (_match, token: string) => {
      const variable = TEMPLATE_VARIABLES.find((v) => v.token === token)
      if (!variable) {
        unknown.add(token)
        return `{{${token}}}`
      }
      const value = values[token]
      if (!value) {
        missing.set(token, variable)
        // Left in place and highlighted, so nothing is silently blank.
        return `{{${token}}}`
      }
      return value
    })

  return {
    subject: substitute(template.subject ?? ''),
    body: substitute(template.body),
    missing: [...missing.values()],
    unknown: [...unknown],
  }
}

/** Tokens used by a template, for the editor's "uses" line. */
export function tokensUsed(template: MessageTemplate): string[] {
  const found = new Set<string>()
  const scan = (text: string) => {
    for (const match of text.matchAll(TOKEN_RE)) if (match[1]) found.add(match[1])
  }
  scan(template.subject ?? '')
  scan(template.body)
  return [...found]
}

/* ------------------------------- built-ins -------------------------------- */

interface Seed {
  name: string
  category: TemplateCategory
  subject: string
  body: string
}

const SEEDS: Seed[] = [
  {
    name: 'Application follow-up',
    category: 'application_follow_up',
    subject: '{{role}} application — following up',
    body: `Hi {{first_name}},

I applied for the {{role}} role at {{company}} on {{applied_date}} and wanted to check in on where things stand.

Since applying I have been reading more about how the team works, and the part of the role I keep coming back to is [the specific thing you care about]. If it would help, I am happy to share [a relevant piece of work].

Is there anything useful I can send over in the meantime?

Best,
{{my_name}}`,
  },
  {
    name: 'Thank-you after an interview',
    category: 'interview_thank_you',
    subject: 'Thank you — {{role}} {{interview_type}} conversation',
    body: `Hi {{first_name}},

Thank you for the time today. I enjoyed the conversation, particularly [the specific thing you discussed].

One thing I did not get to say: [the point you wish you had made].

You mentioned [something they raised] — I gave it more thought afterwards and [your follow-up thought].

Looking forward to the next step.

Best,
{{my_name}}`,
  },
  {
    name: 'Answering the question you fumbled',
    category: 'interview_thank_you',
    subject: 'Following up on one question — {{role}}',
    body: `Hi {{first_name}},

Thanks again for the {{interview_type}} conversation on {{interview_date}}.

You asked about [the question], and I gave a thinner answer than I would have liked. With a bit more time to think:

[The answer you would give now, in three or four sentences.]

Happy to go deeper if it is useful.

Best,
{{my_name}}`,
  },
  {
    name: 'Referral request',
    category: 'referral_request',
    subject: 'A favour — {{company}}',
    body: `Hi {{first_name}},

Hope you are well. [One sentence on how you know each other or what you last spoke about.]

I am putting my name in for the {{role}} role at {{company}}, and I noticed you are connected there. Would you be comfortable referring me, or pointing me to the right person?

Happy to send a short summary of why I think it is a fit so you have something to forward. No pressure at all if it is not the right moment.

Thanks either way,
{{my_name}}`,
  },
  {
    name: 'Keeping a contact warm',
    category: 'networking',
    subject: 'Checking in',
    body: `Hi {{first_name}},

It has been a while — I came across [the thing that made you think of them] and thought of our conversation about [topic].

I am currently [one line on what you are looking for]. No ask attached; mostly wanted to say hello and hear what you are working on.

Best,
{{my_name}}`,
  },
  {
    name: 'Reply to inbound recruiter',
    category: 'recruiter_reply',
    subject: 'Re: {{role}} at {{company}}',
    body: `Hi {{first_name}},

Thanks for reaching out about the {{role}} role — it is interesting enough that I would like to hear more.

Before we set up a call, three things that would help me:

1. What does success in this role look like in the first six months?
2. What is the compensation range?
3. Who would I report to, and how large is the team?

I have time [your availability] if a call makes sense.

Best,
{{my_name}}`,
  },
  {
    name: 'Asking for time on an offer',
    category: 'offer',
    subject: '{{role}} offer — a short extension',
    body: `Hi {{first_name}},

Thank you for the offer — I am genuinely pleased, and {{company}} is high on my list.

I have one or two conversations finishing this week, and I want to give you a decision I am certain about rather than a quick one. Could we agree a decision date of [date]?

In the meantime, could you send the full breakdown of [equity / bonus / benefits] so I am comparing like with like?

Best,
{{my_name}}`,
  },
  {
    name: 'Compensation counter',
    category: 'offer',
    subject: 'Re: {{role}} offer',
    body: `Hi {{first_name}},

Thanks again for the offer. I want to make this work.

Based on [the market data or competing range you have], I was targeting [number] on base. If you can get to that, I am ready to sign.

If base is fixed by band, I am open to closing the gap through [sign-on / equity / review timing] instead — whatever is easiest on your side.

Best,
{{my_name}}`,
  },
]

export function buildBuiltInTemplates(): MessageTemplate[] {
  const ts = nowIso()
  return SEEDS.map((seed) => ({
    id: newId('tp_'),
    name: seed.name,
    category: seed.category,
    subject: seed.subject,
    body: seed.body,
    builtIn: true,
    createdAt: ts,
    updatedAt: ts,
  }))
}

/** Ranks templates for a given situation so the composer opens on a sane one. */
export function suggestCategory(ctx: TemplateContext): TemplateCategory {
  if (ctx.interview) return 'interview_thank_you'
  const stage = ctx.opportunity?.stage
  if (stage === 'offer' || stage === 'accepted') return 'offer'
  if (ctx.contact?.relationship === 'recruiter') return 'recruiter_reply'
  if (ctx.contact?.relationship === 'referral' || ctx.contact?.relationship === 'alumni') {
    return ctx.opportunity ? 'referral_request' : 'networking'
  }
  if (ctx.opportunity?.dateApplied) return 'application_follow_up'
  return 'networking'
}
