import * as React from 'react'
import { DEMO_OPPORTUNITY_COUNT } from '@/lib/demo-meta'
import { ArrowRight, Compass, Database, ShieldCheck } from 'lucide-react'
import { AppMark } from './layout/AppMark'
import { Button, Spinner } from './ui/primitives'
import { useToast } from './ui/toast'
import { usePreferences } from '@/state/preferences'
import { cn } from '@/lib/utils'

/**
 * First launch. The user decides whether to start from nothing or explore a
 * populated workspace — nothing is written until they choose.
 */
export function Onboarding() {
  const { set } = usePreferences()
  const toast = useToast()
  const [busy, setBusy] = React.useState<'demo' | 'fresh' | null>(null)

  const startDemo = async () => {
    setBusy('demo')
    try {
      const { counts } = await (await import('@/lib/demo')).seedDemoWorkspace()
      set('onboarded', true)
      toast.success(
        'Demo workspace loaded',
        `${counts.opportunities} opportunities, ${counts.contacts} contacts, ${counts.interviews} interviews.`,
      )
    } catch (error) {
      toast.error(
        'Could not load the demo workspace',
        error instanceof Error ? error.message : 'Your browser may be blocking local storage.',
      )
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3">
          <AppMark className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.015em] text-fg">Opportunity OS</h1>
            <p className="text-sm text-muted">A command centre for a serious job search.</p>
          </div>
        </div>

        <p className="mt-6 max-w-xl text-balance text-md leading-relaxed text-muted">
          One place for the roles you are chasing, the people who can help, the interviews you are preparing for
          and the stories you tell in them — with a clear answer every morning to what needs doing today.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            icon={<Compass />}
            title="Explore the demo workspace"
            description={`${DEMO_OPPORTUNITY_COUNT} fictional opportunities with real history: overdue actions, interviews this week, rounds that were lost, an offer on the table and enough data for the analytics to mean something.`}
            footer="You can clear it at any time from Settings."
            action={
              <Button variant="primary" loading={busy === 'demo'} iconRight={<ArrowRight />} onClick={() => void startDemo()}>
                Explore the demo
              </Button>
            }
            highlighted
          />
          <ChoiceCard
            icon={<Database />}
            title="Start fresh"
            description="An empty workspace. Add your first opportunity in seconds — company and role are the only required fields."
            footer="You can load the demo later from Settings → Data."
            action={
              <Button
                variant="secondary"
                loading={busy === 'fresh'}
                onClick={() => {
                  setBusy('fresh')
                  set('onboarded', true)
                }}
              >
                Start fresh
              </Button>
            }
          />
        </div>

        <div className="mt-7 flex items-start gap-2.5 rounded-lg border border-line bg-subtle/60 px-3.5 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-fg">Your workspace stays on this device.</span> Opportunity OS has
            no account server and does not transmit your job-search data. Everything is stored in this browser,
            and you can export all of it as JSON or CSV whenever you like.
          </p>
        </div>

        {busy && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner />
            Setting up your workspace…
          </p>
        )}
      </div>
    </div>
  )
}

function ChoiceCard({
  icon,
  title,
  description,
  footer,
  action,
  highlighted,
}: {
  icon: React.ReactNode
  title: string
  description: string
  footer: string
  action: React.ReactNode
  highlighted?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-panel p-4',
        highlighted ? 'border-accent/40 shadow-sm ring-1 ring-accent/10' : 'border-line',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg border [&>svg]:h-4 [&>svg]:w-4',
          highlighted ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line bg-subtle text-muted',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <h2 className="mt-3 text-md font-semibold text-fg">{title}</h2>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{description}</p>
      <p className="mt-3 text-xs text-faint">{footer}</p>
      <div className="mt-3">{action}</div>
    </div>
  )
}
