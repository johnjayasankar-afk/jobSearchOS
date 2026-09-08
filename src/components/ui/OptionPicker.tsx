import * as React from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Kbd } from './primitives'

export interface PickerOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
  group?: string
}

/**
 * A small centred list for changing one field with the keyboard — the thing a
 * dropdown cannot be, because a dropdown has to be anchored to something the
 * pointer clicked. Opens on the current value, moves with the arrow keys,
 * commits on Enter.
 */
export function OptionPicker<T extends string>({
  open,
  onOpenChange,
  title,
  description,
  options,
  value,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  options: Array<PickerOption<T>>
  value?: T
  onPick: (value: T) => void
}) {
  const [cursor, setCursor] = React.useState(0)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const index = options.findIndex((o) => o.value === value)
    setCursor(index >= 0 ? index : 0)
  }, [open, value, options])

  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const groups = React.useMemo(() => {
    const seen: string[] = []
    for (const option of options) {
      const key = option.group ?? ''
      if (!seen.includes(key)) seen.push(key)
    }
    return seen
  }, [options])

  let index = -1

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[55] bg-[hsl(var(--shadow)/0.3)] data-[state=open]:animate-fade-in" />
        <RDialog.Content
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            // Keep the cursor highlight as the single indicator of position:
            // letting focus land on the first option shows two at once.
            event.preventDefault()
            ;(event.currentTarget as HTMLElement).focus({ preventScroll: true })
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setCursor((c) => (c + 1) % options.length)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setCursor((c) => (c - 1 + options.length) % options.length)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              const option = options[cursor]
              if (option) {
                onPick(option.value)
                onOpenChange(false)
              }
            }
          }}
          className={cn(
            'fixed left-1/2 top-[18vh] z-[56] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2',
            'overflow-hidden rounded-xl border border-line bg-panel shadow-xl outline-none',
            'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
          )}
        >
          <div className="border-b border-line px-3.5 py-2.5">
            <RDialog.Title className="text-base font-medium text-fg">{title}</RDialog.Title>
            {description && (
              <RDialog.Description className="mt-0.5 truncate text-sm text-muted">
                {description}
              </RDialog.Description>
            )}
          </div>

          <div ref={listRef} role="listbox" aria-label={title} className="max-h-72 overflow-y-auto p-1.5">
            {groups.map((group) => (
              <div key={group || 'default'}>
                {group && (
                  <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-faint">
                    {group}
                  </p>
                )}
                {options
                  .filter((o) => (o.group ?? '') === group)
                  .map((option) => {
                    index += 1
                    const active = index === cursor
                    const myIndex = index
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        data-index={myIndex}
                        aria-selected={active}
                        onMouseMove={() => setCursor(myIndex)}
                        onClick={() => {
                          onPick(option.value)
                          onOpenChange(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-base transition-colors',
                          active ? 'bg-subtle text-fg' : 'text-muted',
                        )}
                      >
                        {option.icon && <span className="shrink-0">{option.icon}</span>}
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {option.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-line bg-subtle/60 px-3 py-1.5 text-2xs text-faint">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              move
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              apply
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Kbd>Esc</Kbd>
              cancel
            </span>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
