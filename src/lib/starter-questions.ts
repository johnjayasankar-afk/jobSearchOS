/**
 * Starter question sets for other fields.
 *
 * The built-in bank was written from product-management interviews. Cycle six
 * made the bank editable, which is not the same as usable: nobody writes twenty
 * questions from scratch to get started, so anyone outside product still opened
 * a list that was mostly not about them.
 *
 * These are curated starting points, loaded as *your own* questions so they can
 * be edited or deleted like anything you wrote. They are added rather than
 * swapped in — most of the built-ins about failure, conflict and stakeholders
 * apply to any field, and the ones that do not can be set aside individually.
 */
import type { CustomQuestion, InterviewType, StoryTag } from './types'

export type Discipline = 'engineering' | 'design' | 'data' | 'marketing'

export interface StarterSet {
  id: Discipline
  label: string
  /** Shown on the card, so the choice is made on substance. */
  description: string
  questions: Array<Omit<CustomQuestion, 'id' | 'createdAt' | 'updatedAt'>>
}

const behavioural: InterviewType[] = ['hiring_manager', 'behavioral', 'panel']
const technical: InterviewType[] = ['technical', 'hiring_manager', 'panel']

function q(
  text: string,
  theme: StoryTag,
  listeningFor: string,
  formats: InterviewType[] = behavioural,
  also?: StoryTag[],
): Omit<CustomQuestion, 'id' | 'createdAt' | 'updatedAt'> {
  return { text, theme, also, formats, listeningFor }
}

export const STARTER_SETS: StarterSet[] = [
  {
    id: 'engineering',
    label: 'Engineering',
    description: 'Systems, trade-offs, incidents, code review and working with product.',
    questions: [
      q(
        'Walk me through the hardest bug you have debugged.',
        'Technical',
        'The method, not the war story. How you narrowed it down is the answer.',
        technical,
      ),
      q(
        'Describe a system you designed. What would you change now?',
        'Technical',
        'Whether you can criticise your own design without being asked twice.',
        technical,
        ['Strategy'],
      ),
      q(
        'Tell me about an incident you were on point for.',
        'Execution',
        'What you did in the first ten minutes, and what changed afterwards so it could not recur.',
        technical,
        ['Failure'],
      ),
      q(
        'How have you handled a code review disagreement that got stuck?',
        'Conflict',
        'Whether the standard you argued for was about the code or about being right.',
      ),
      q(
        'Tell me about a migration you ran on a live system.',
        'Execution',
        'The rollback plan. Anyone can describe the happy path.',
        technical,
      ),
      q(
        'When did you choose the boring technology over the interesting one?',
        'Strategy',
        'That the decision was about the team and the timeline, not about taste.',
        technical,
      ),
      q(
        'Describe a time you had to say an estimate was wrong.',
        'Stakeholders',
        'How early you said it. Everyone is wrong; the difference is the timing.',
      ),
      q(
        'Tell me about performance work you did that mattered.',
        'Technical',
        'That you measured before you optimised, and know what the bottleneck actually was.',
        technical,
        ['Analytics'],
      ),
      q(
        'How do you decide what to test?',
        'Technical',
        'A working philosophy, not a coverage number.',
        technical,
      ),
      q(
        'Tell me about mentoring an engineer who was struggling.',
        'Leadership',
        'What you changed in how you worked with them, specifically.',
      ),
      q(
        'When have you pushed back on a product requirement?',
        'Stakeholders',
        'Whether you brought an alternative or only an objection.',
        behavioural,
        ['Conflict'],
      ),
      q(
        'Tell me about technical debt you chose to live with.',
        'Strategy',
        'That it was a decision with a revisit date, not an accident you are describing kindly.',
        technical,
      ),
      q(
        'Describe something you shipped that you had to roll back.',
        'Failure',
        'How you found out — from monitoring, or from a user.',
        technical,
      ),
      q(
        'How have you worked with an on-call rotation you inherited?',
        'Execution',
        'Whether the noise went down and how you knew.',
        technical,
        ['Leadership'],
      ),
    ],
  },
  {
    id: 'design',
    label: 'Design',
    description: 'Critique, research, craft, and defending decisions without defending taste.',
    questions: [
      q(
        'Walk me through a design critique you led.',
        'Leadership',
        'Whether you made the room safe enough that the work actually got criticised.',
      ),
      q(
        'Tell me about work you had to defend to someone senior.',
        'Stakeholders',
        'Whether you argued from the user problem or from preference.',
        behavioural,
        ['Conflict'],
      ),
      q(
        'Describe research that changed what you were going to build.',
        'Analytics',
        'That the research happened early enough to be able to change anything.',
      ),
      q(
        'Tell me about a design you were wrong about.',
        'Failure',
        'What in the process let the mistake through, not just what the mistake was.',
      ),
      q(
        'How have you designed within a system that did not fit?',
        'Technical',
        'Whether you extended the system or worked around it, and how you decided.',
      ),
      q(
        'Describe a time you simplified something significantly.',
        'Execution',
        'What you removed and who objected to losing it.',
        behavioural,
        ['Strategy'],
      ),
      q(
        'Tell me about working with an engineer who pushed back on feasibility.',
        'Stakeholders',
        'Whether you found the constraint underneath the objection.',
      ),
      q(
        'How do you know a design is finished?',
        'Strategy',
        'A working answer, not "when it ships".',
      ),
      q(
        'Describe accessibility work you did that was not asked for.',
        'Execution',
        'Whether it was a checklist or a decision that changed the design.',
      ),
      q(
        'Tell me about a brief that was wrong.',
        'Conflict',
        'How you reframed it, and whether the person who wrote it came with you.',
      ),
      q(
        'Walk me through something you took from a blank page.',
        '0→1',
        'The sequence of what you resolved first, and why that order.',
        ['product_sense', 'hiring_manager', 'panel'],
      ),
      q(
        'How have you measured whether a design worked?',
        'Analytics',
        'That the measure was agreed before the launch, not chosen after it.',
        behavioural,
        ['Growth'],
      ),
      q(
        'Tell me about giving hard feedback on a colleague’s work.',
        'Conflict',
        'Whether it was specific enough to be actionable.',
      ),
      q(
        'Describe a constraint that made the work better.',
        'Strategy',
        'A real constraint you resented at the time.',
      ),
    ],
  },
  {
    id: 'data',
    label: 'Data & analytics',
    description: 'Rigour, ambiguity, stakeholders who want a number, and being wrong in public.',
    questions: [
      q(
        'Tell me about an analysis that changed a decision.',
        'Analytics',
        'Whether the decision would genuinely have gone the other way without it.',
        ['product_execution', 'case', 'hiring_manager'],
      ),
      q(
        'Describe a time your analysis was wrong.',
        'Failure',
        'How it was caught, and what you changed in your process afterwards.',
      ),
      q(
        'How have you handled a stakeholder who wanted a specific answer?',
        'Stakeholders',
        'Where you drew the line, and what it cost you.',
        behavioural,
        ['Conflict'],
      ),
      q(
        'Walk me through a metric you defined and later regretted.',
        'Analytics',
        'How it was gamed, and whether you saw it coming.',
        ['product_execution', 'case', 'technical'],
      ),
      q(
        'Tell me about working with data you did not trust.',
        'Technical',
        'What you did to bound the uncertainty rather than ignore it.',
        technical,
      ),
      q(
        'Describe an experiment that came back flat.',
        'Growth',
        'Whether you had pre-registered what you would do either way.',
        ['product_execution', 'case'],
      ),
      q(
        'How do you decide an analysis is good enough to ship?',
        'Strategy',
        'A stopping rule, not perfectionism.',
      ),
      q(
        'Tell me about explaining something technical to a non-technical audience.',
        'Stakeholders',
        'What you left out, and whether that was honest.',
      ),
      q(
        'Describe a pipeline or model you had to maintain.',
        'Execution',
        'What broke, how often, and what you did about it.',
        technical,
      ),
      q(
        'When have you argued against a metric everyone liked?',
        'Conflict',
        'Whether you offered a better measure or only a criticism.',
        behavioural,
        ['Analytics'],
      ),
      q(
        'Tell me about a result you had to present that people did not want.',
        'Stakeholders',
        'How you framed it so it could be acted on rather than argued with.',
      ),
      q(
        'How have you dealt with a question that the data could not answer?',
        'Analytics',
        'That you said so plainly, and what you offered instead.',
        ['product_execution', 'case', 'panel'],
      ),
      q(
        'Describe automation you built that saved real time.',
        'Execution',
        'The time it actually saved, measured rather than assumed.',
        technical,
      ),
      q(
        'Tell me about a model whose output could be wrong in a costly way.',
        'AI',
        'What you built around the failure mode, not inside the model.',
        technical,
        ['Technical'],
      ),
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing & growth',
    description: 'Channels, positioning, budget you had to justify, and campaigns that failed.',
    questions: [
      q(
        'Tell me about a campaign that did not work.',
        'Failure',
        'When you called it, and what the money would have done elsewhere.',
        behavioural,
        ['Growth'],
      ),
      q(
        'Describe positioning you changed.',
        'Strategy',
        'What evidence moved you, and who had to be convinced.',
        ['hiring_manager', 'founder', 'case'],
      ),
      q(
        'How have you decided where to spend a fixed budget?',
        'Strategy',
        'The thing you chose not to fund, and whether that hurt.',
        behavioural,
        ['Analytics'],
      ),
      q(
        'Tell me about a channel you grew from nothing.',
        '0→1',
        'The unglamorous early work, not the scaled version.',
        ['product_sense', 'founder', 'hiring_manager'],
      ),
      q(
        'Describe a time attribution was genuinely unclear.',
        'Analytics',
        'How you decided anyway, and what you told the people asking.',
        ['product_execution', 'case'],
      ),
      q(
        'How have you worked with a sales team that wanted different leads?',
        'Stakeholders',
        'Whether you changed the definition or the targeting, and who agreed to it.',
        behavioural,
        ['Conflict'],
      ),
      q(
        'Tell me about messaging you tested that surprised you.',
        'Growth',
        'That it was a real test and you acted on the result.',
        ['product_execution', 'case'],
      ),
      q(
        'Describe a launch you owned end to end.',
        'Execution',
        'Where the coordination nearly failed, which is where launches actually live.',
      ),
      q(
        'When have you pushed back on a brand decision?',
        'Conflict',
        'Whether you argued from the audience or from taste.',
      ),
      q(
        'How do you know a piece of content earned its cost?',
        'Analytics',
        'A measure you set beforehand.',
        behavioural,
        ['Growth'],
      ),
      q(
        'Tell me about growth that turned out to be the wrong kind.',
        'Failure',
        'How long it took to notice, and what the metric was hiding.',
        ['product_execution', 'case'],
      ),
      q(
        'Describe working with a product team that shipped something unmarketable.',
        'Stakeholders',
        'How early you were in the room, and what you changed about that afterwards.',
      ),
      q(
        'How have you handled a competitor doing something you could not answer?',
        'Strategy',
        'Whether you responded or deliberately did not, and why.',
        ['hiring_manager', 'founder', 'case'],
      ),
      q(
        'Tell me about a team you built or grew.',
        'Leadership',
        'A concrete intervention with someone specific.',
      ),
    ],
  },
]

export function starterSet(id: Discipline): StarterSet | undefined {
  return STARTER_SETS.find((set) => set.id === id)
}
