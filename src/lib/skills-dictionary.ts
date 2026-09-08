/**
 * A deterministic vocabulary used to recognise skills, tools and domains in a
 * pasted job description. Each entry maps a canonical label to the surface
 * forms that should match it. Matching is plain word-boundary search — there is
 * no model and no network call anywhere in this file.
 */

export interface VocabEntry {
  label: string
  aliases: string[]
  kind: 'skill' | 'tool' | 'domain'
}

const e = (label: string, kind: VocabEntry['kind'], ...aliases: string[]): VocabEntry => ({
  label,
  kind,
  aliases: [label.toLowerCase(), ...aliases.map((a) => a.toLowerCase())],
})

export const VOCABULARY: VocabEntry[] = [
  // ---- Product & strategy ----
  e('Product Strategy', 'skill', 'product vision', 'strategic roadmap'),
  e('Roadmapping', 'skill', 'roadmap', 'roadmaps'),
  e('Product Discovery', 'skill', 'discovery', 'customer discovery'),
  e('User Research', 'skill', 'user interviews', 'ux research', 'customer research'),
  e('A/B Testing', 'skill', 'ab testing', 'a/b tests', 'experimentation', 'split testing'),
  e('Product Analytics', 'skill', 'product metrics', 'funnel analysis'),
  e('Go-to-Market', 'skill', 'gtm', 'go to market'),
  e('Pricing', 'skill', 'monetization', 'monetisation'),
  e('Growth', 'skill', 'growth loops', 'user acquisition', 'retention'),
  e('Stakeholder Management', 'skill', 'stakeholder', 'cross-functional leadership'),
  e('Prioritization', 'skill', 'prioritisation', 'backlog management'),
  // Not "Requirements" on its own: almost every posting has that as a heading.
  e('Product Requirements', 'skill', 'prd', 'product requirements doc', 'user stories', 'product specs'),
  e('Agile', 'skill', 'scrum', 'kanban', 'sprint planning'),
  e('OKRs', 'skill', 'okr', 'goal setting'),
  e('Competitive Analysis', 'skill', 'market analysis', 'competitor research'),
  e('Customer Success', 'skill', 'account management'),
  e('Program Management', 'skill', 'tpm', 'technical program management'),
  e('People Management', 'skill', 'managing engineers', 'team leadership', 'direct reports'),
  e('Mentorship', 'skill', 'coaching', 'mentoring'),
  e('Storytelling', 'skill', 'narrative', 'executive communication'),

  // ---- Data & analytics ----
  e('SQL', 'skill', 'postgresql', 'mysql', 'ansi sql'),
  e('Python', 'skill'),
  e('R', 'skill'),
  e('Data Analysis', 'skill', 'analytics', 'data analytics'),
  e('Data Modeling', 'skill', 'data modelling', 'dimensional modeling'),
  e('Statistics', 'skill', 'statistical analysis', 'inference'),
  e('Machine Learning', 'skill', 'ml', 'predictive modeling'),
  e('Experiment Design', 'skill', 'causal inference'),
  e('ETL', 'skill', 'elt', 'data pipelines'),
  e('Dashboards', 'skill', 'reporting', 'bi'),

  // ---- Engineering ----
  e('TypeScript', 'skill', 'ts'),
  e('JavaScript', 'skill', 'js', 'es6'),
  e('React', 'skill', 'react.js', 'reactjs'),
  e('Next.js', 'skill', 'nextjs'),
  e('Node.js', 'skill', 'nodejs', 'node'),
  e('Go', 'skill', 'golang'),
  e('Rust', 'skill'),
  e('Java', 'skill'),
  e('Kotlin', 'skill'),
  e('Swift', 'skill', 'swiftui'),
  e('C++', 'skill', 'cpp'),
  e('C#', 'skill', 'dotnet', '.net'),
  e('Ruby', 'skill', 'rails', 'ruby on rails'),
  e('PHP', 'skill', 'laravel'),
  e('GraphQL', 'skill'),
  e('REST APIs', 'skill', 'rest api', 'restful'),
  e('Microservices', 'skill'),
  e('Distributed Systems', 'skill'),
  e('System Design', 'skill', 'architecture'),
  // "testing" alone collides with "A/B testing"; match the specific practices.
  e('QA & Testing', 'skill', 'unit tests', 'test automation', 'automated testing', 'regression testing', 'quality assurance'),
  e('CI/CD', 'skill', 'continuous integration', 'continuous delivery'),
  e('Kubernetes', 'skill', 'k8s'),
  e('Docker', 'skill', 'containers'),
  e('AWS', 'skill', 'amazon web services'),
  e('GCP', 'skill', 'google cloud'),
  e('Azure', 'skill'),
  e('Terraform', 'skill', 'infrastructure as code'),
  e('Observability', 'skill', 'monitoring', 'telemetry'),
  e('Security', 'skill', 'appsec', 'infosec'),
  e('Accessibility', 'skill', 'a11y', 'wcag'),
  e('Performance', 'skill', 'performance optimization', 'latency'),
  e('Mobile', 'skill', 'ios', 'android', 'react native'),

  // ---- Design ----
  e('UX Design', 'skill', 'user experience', 'ux'),
  e('UI Design', 'skill', 'visual design', 'interface design'),
  e('Prototyping', 'skill', 'wireframing', 'wireframes'),
  e('Design Systems', 'skill', 'component library'),
  e('Interaction Design', 'skill', 'ixd'),

  // ---- Marketing, sales, ops, finance ----
  e('Content Marketing', 'skill', 'content strategy'),
  e('SEO', 'skill', 'search engine optimization'),
  e('Paid Acquisition', 'skill', 'performance marketing', 'sem', 'paid media'),
  e('Lifecycle Marketing', 'skill', 'crm marketing', 'email marketing'),
  e('Brand', 'skill', 'brand strategy'),
  e('Sales Enablement', 'skill'),
  e('Partnerships', 'skill', 'bd', 'business development'),
  e('Financial Modeling', 'skill', 'financial modelling', 'forecasting'),
  e('Budgeting', 'skill', 'p&l', 'pnl'),
  e('Operations', 'skill', 'process improvement'),
  e('Compliance', 'skill', 'regulatory'),

  // ---- Tools ----
  e('Figma', 'tool'),
  e('Jira', 'tool'),
  e('Linear', 'tool'),
  e('Notion', 'tool'),
  e('Confluence', 'tool'),
  e('Amplitude', 'tool'),
  e('Mixpanel', 'tool'),
  e('Looker', 'tool'),
  e('Tableau', 'tool'),
  e('Power BI', 'tool', 'powerbi'),
  e('Snowflake', 'tool'),
  e('dbt', 'tool'),
  e('BigQuery', 'tool'),
  e('Databricks', 'tool'),
  e('Segment', 'tool'),
  e('Salesforce', 'tool'),
  e('HubSpot', 'tool'),
  e('Airtable', 'tool'),
  e('Datadog', 'tool'),
  e('Sentry', 'tool'),
  e('Git', 'tool', 'github', 'gitlab'),
  e('Excel', 'tool', 'spreadsheets', 'google sheets'),
  e('Braze', 'tool'),
  e('Optimizely', 'tool'),
  e('Statsig', 'tool'),

  // ---- Domains ----
  e('Fintech', 'domain', 'financial services', 'payments', 'banking'),
  e('Healthcare', 'domain', 'healthtech', 'health tech', 'clinical', 'digital health'),
  e('E-commerce', 'domain', 'ecommerce', 'commerce', 'retail', 'marketplace'),
  e('B2B SaaS', 'domain', 'b2b', 'saas', 'enterprise software'),
  e('Enterprise SaaS', 'domain', 'enterprise saas'),
  e('Consumer', 'domain', 'b2c', 'consumer product'),
  e('AI', 'domain', 'artificial intelligence', 'llm', 'genai', 'generative ai', 'ml platform'),
  e('Data Infrastructure', 'domain', 'data platform', 'data infrastructure'),
  e('Developer Tools', 'domain', 'devtools', 'developer platform', 'devex'),
  e('Security', 'domain', 'cybersecurity', 'security products'),
  e('Education', 'domain', 'edtech', 'ed tech', 'learning'),
  e('Logistics', 'domain', 'supply chain', 'fulfillment'),
  e('Climate', 'domain', 'climate tech', 'sustainability', 'energy'),
  e('Media', 'domain', 'streaming', 'entertainment', 'publishing'),
  e('Real Estate', 'domain', 'proptech'),
  e('Gaming', 'domain', 'games'),
  e('Travel', 'domain', 'hospitality'),
  e('HR Tech', 'domain', 'hrtech', 'people ops', 'recruiting software'),
  e('Insurance', 'domain', 'insurtech'),
  e('Government', 'domain', 'govtech', 'public sector'),
  e('Crypto', 'domain', 'web3', 'blockchain'),
  e('Robotics', 'domain', 'autonomy', 'hardware'),
  e('Biotech', 'domain', 'life sciences', 'pharma'),
]

export const VOCAB_LABELS = VOCABULARY.map((v) => v.label)

export const SKILL_SUGGESTIONS = VOCABULARY.filter((v) => v.kind === 'skill').map((v) => v.label)
export const TOOL_SUGGESTIONS = VOCABULARY.filter((v) => v.kind === 'tool').map((v) => v.label)
export const DOMAIN_SUGGESTIONS = VOCABULARY.filter((v) => v.kind === 'domain').map((v) => v.label)

export const ROLE_SUGGESTIONS = [
  'Product Manager',
  'Senior Product Manager',
  'Group Product Manager',
  'Director of Product',
  'Principal Product Manager',
  'Technical Program Manager',
  'Software Engineer',
  'Senior Software Engineer',
  'Staff Software Engineer',
  'Engineering Manager',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
  'Data Scientist',
  'Data Analyst',
  'Analytics Engineer',
  'Machine Learning Engineer',
  'Product Designer',
  'UX Researcher',
  'Design Manager',
  'Product Marketing Manager',
  'Growth Manager',
  'Chief of Staff',
  'Operations Manager',
  'Solutions Architect',
  'Customer Success Manager',
]
