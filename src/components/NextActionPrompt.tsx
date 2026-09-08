import * as React from 'react'
import { Modal } from '@/components/ui/overlay'
import { Button } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { useAppUi } from '@/state/app-ui'
import { setNextAction } from '@/lib/repo'
import { dateOnlyPlusDays, today } from '@/lib/utils'

const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
]

const SUGGESTIONS = [
  'Tailor the résumé and submit',
  'Follow up with the recruiter',
  'Reach out to someone on the team',
  'Prepare for the next interview',
  'Decide whether to apply',
]

/** A one-field prompt for planning the next step, opened from Today or a card. */
export function NextActionPrompt() {
  const ui = useAppUi()
  const toast = useToast()
  const opportunity = ui.nextActionPrompt.opportunity
  const [action, setAction] = React.useState('')
  const [date, setDate] = React.useState(today())
  const [saving, setSaving] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!ui.nextActionPrompt.open) return
    setAction(opportunity?.nextAction ?? '')
    setDate(opportunity?.nextActionDate ?? dateOnlyPlusDays(1))
  }, [ui.nextActionPrompt.open, opportunity])

  if (!opportunity) return null

  const save = async () => {
    if (!action.trim()) {
      inputRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      await setNextAction(opportunity.id, action, date || undefined)
      ui.closeNextActionPrompt()
      toast.success('Next action set', `${opportunity.company} · ${action.trim()}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={ui.nextActionPrompt.open}
      onOpenChange={(open) => !open && ui.closeNextActionPrompt()}
      title="Plan the next step"
      description={`${opportunity.company} · ${opportunity.role}`}
      size="md"
      initialFocusRef={inputRef}
      footer={
        <>
          <Button variant="ghost" onClick={() => ui.closeNextActionPrompt()}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Set next action
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="What is the next action?" htmlFor="next-action">
          <Input
            id="next-action"
            ref={inputRef}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Follow up with the recruiter"
            autoComplete="off"
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setAction(suggestion)}
              className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <Field label="Due" htmlFor="next-action-date" hint="A dated action is what lets Today surface it.">
          <div className="space-y-2">
            <Input id="next-action-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDate(dateOnlyPlusDays(preset.days))}
                  className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </Field>
      </form>
    </Modal>
  )
}
