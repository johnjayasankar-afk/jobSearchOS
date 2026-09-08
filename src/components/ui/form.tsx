import * as React from 'react'
import * as RSelect from '@radix-ui/react-select'
import * as RCheckbox from '@radix-ui/react-checkbox'
import * as RSwitch from '@radix-ui/react-switch'
import * as RSlider from '@radix-ui/react-slider'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { cn, uniq } from '@/lib/utils'

/* ---------------------------------- Field --------------------------------- */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
  action,
}: {
  label?: string
  hint?: React.ReactNode
  error?: string | null
  required?: boolean
  htmlFor?: string
  className?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || action) && (
        <div className="flex min-h-[17px] items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="label">
              {label}
              {required && <span className="ml-0.5 text-critical">*</span>}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs text-critical" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

/* ---------------------------------- Input --------------------------------- */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  prefixNode?: React.ReactNode
  suffixNode?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, prefixNode, suffixNode, ...props },
  ref,
) {
  if (prefixNode || suffixNode) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 shadow-xs transition-[border-color,box-shadow] duration-100',
          'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 hover:border-line-strong',
          invalid && 'border-critical focus-within:border-critical focus-within:ring-critical/25',
          className,
        )}
      >
        {prefixNode && <span className="shrink-0 text-faint [&>svg]:h-3.5 [&>svg]:w-3.5">{prefixNode}</span>}
        <input
          ref={ref}
          className="h-7 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-faint disabled:text-faint"
          {...props}
        />
        {suffixNode && <span className="shrink-0 text-faint">{suffixNode}</span>}
      </div>
    )
  }
  return (
    <input
      ref={ref}
      className={cn('field', invalid && 'field-invalid', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; autoGrow?: boolean }
>(function Textarea({ className, invalid, autoGrow, onChange, ...props }, ref) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null)
  const setRefs = (node: HTMLTextAreaElement | null) => {
    innerRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
  }
  const resize = React.useCallback(() => {
    const el = innerRef.current
    if (!el || !autoGrow) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [autoGrow])

  React.useLayoutEffect(resize, [resize, props.value])

  return (
    <textarea
      ref={setRefs}
      onChange={(e) => {
        onChange?.(e)
        resize()
      }}
      className={cn('field resize-y leading-relaxed', invalid && 'field-invalid', autoGrow && 'resize-none overflow-hidden', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})

/* --------------------------------- Select --------------------------------- */

export interface SelectOption<T extends string> {
  value: T
  label: string
  description?: string
  icon?: React.ReactNode
  group?: string
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
  id,
  size = 'md',
  disabled,
  ariaLabel,
  renderValue,
}: {
  value: T | undefined
  onChange: (value: T) => void
  options: Array<SelectOption<T>>
  placeholder?: string
  className?: string
  id?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  ariaLabel?: string
  renderValue?: (option: SelectOption<T> | undefined) => React.ReactNode
}) {
  const selected = options.find((o) => o.value === value)
  const groups = uniq(options.map((o) => o.group ?? ''))

  return (
    <RSelect.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <RSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-line bg-panel px-2.5 text-base text-fg shadow-xs',
          'transition-[border-color,box-shadow] duration-100 hover:border-line-strong',
          'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
          'data-[placeholder]:text-faint disabled:cursor-not-allowed disabled:bg-subtle disabled:text-faint',
          size === 'sm' ? 'h-7 text-sm' : 'h-8',
          className,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
          {renderValue ? (
            renderValue(selected)
          ) : (
            <RSelect.Value placeholder={placeholder} />
          )}
        </span>
        <RSelect.Icon>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          collisionPadding={12}
          className={cn(
            'z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden',
            'rounded-lg border border-line bg-panel shadow-lg',
            'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
          )}
        >
          <RSelect.Viewport className="max-h-[inherit] overflow-y-auto p-1">
            {groups.map((group, gi) => (
              <React.Fragment key={group || `g${gi}`}>
                {group && (
                  <div className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-faint">
                    {group}
                  </div>
                )}
                {options
                  .filter((o) => (o.group ?? '') === group)
                  .map((option) => (
                    <RSelect.Item
                      key={option.value}
                      value={option.value}
                      className={cn(
                        'relative flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 pr-7 text-base outline-none',
                        'data-[highlighted]:bg-subtle data-[state=checked]:font-medium',
                        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                      )}
                    >
                      {option.icon && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{option.icon}</span>}
                      <span className="min-w-0 flex-1">
                        <RSelect.ItemText>{option.label}</RSelect.ItemText>
                        {option.description && (
                          <span className="mt-0.5 block text-xs text-faint">{option.description}</span>
                        )}
                      </span>
                      <RSelect.ItemIndicator className="absolute right-2">
                        <Check className="h-3.5 w-3.5 text-accent" />
                      </RSelect.ItemIndicator>
                    </RSelect.Item>
                  ))}
              </React.Fragment>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

/* -------------------------------- Checkbox -------------------------------- */

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  indeterminate,
  className,
  id,
  disabled,
  ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  description?: string
  indeterminate?: boolean
  className?: string
  id?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const control = (
    <RCheckbox.Root
      id={inputId}
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={(v) => onChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-line-strong bg-panel shadow-xs transition-colors',
        'hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent',
        'disabled:opacity-50',
        !label && className,
      )}
    >
      <RCheckbox.Indicator className="text-accent-fg">
        {indeterminate ? (
          <span className="block h-0.5 w-2 rounded-full bg-current" />
        ) : (
          <Check className="h-3 w-3" strokeWidth={3} />
        )}
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  )

  if (!label) return control

  return (
    <div className={cn('flex items-start gap-2', className)}>
      <span className="mt-px">{control}</span>
      <label htmlFor={inputId} className="cursor-pointer select-none text-base leading-tight text-fg">
        {label}
        {description && <span className="mt-0.5 block text-xs font-normal text-muted">{description}</span>}
      </label>
    </div>
  )
}

/* --------------------------------- Switch --------------------------------- */

export function Switch({
  checked,
  onChange,
  id,
  ariaLabel,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  id?: string
  ariaLabel?: string
  disabled?: boolean
}) {
  return (
    <RSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'relative h-[18px] w-8 shrink-0 rounded-full border border-transparent bg-line-strong transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'data-[state=checked]:bg-accent disabled:opacity-50',
      )}
    >
      <RSwitch.Thumb className="block h-3.5 w-3.5 translate-x-[2px] rounded-full bg-white shadow-sm transition-transform duration-150 will-change-transform data-[state=checked]:translate-x-[16px]" />
    </RSwitch.Root>
  )
}

/* --------------------------------- Slider --------------------------------- */

export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ariaLabel,
  className,
}: {
  value: [number, number]
  onChange: (value: [number, number]) => void
  min?: number
  max?: number
  step?: number
  ariaLabel: string
  className?: string
}) {
  return (
    <RSlider.Root
      className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
      value={value}
      onValueChange={(v) => onChange([v[0] ?? min, v[1] ?? max])}
      min={min}
      max={max}
      step={step}
      minStepsBetweenThumbs={1}
      aria-label={ariaLabel}
    >
      <RSlider.Track className="relative h-1 w-full grow rounded-full bg-raised">
        <RSlider.Range className="absolute h-full rounded-full bg-accent" />
      </RSlider.Track>
      {[0, 1].map((i) => (
        <RSlider.Thumb
          key={i}
          aria-label={`${ariaLabel} ${i === 0 ? 'minimum' : 'maximum'}`}
          className="block h-3.5 w-3.5 rounded-full border border-line-strong bg-panel shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        />
      ))}
    </RSlider.Root>
  )
}

/* -------------------------------- TagInput -------------------------------- */

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add and press Enter',
  id,
  max,
  className,
  ariaLabel,
}: {
  value: string[]
  onChange: (value: string[]) => void
  suggestions?: string[]
  placeholder?: string
  id?: string
  max?: number
  className?: string
  ariaLabel?: string
}) {
  const [draft, setDraft] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const available = React.useMemo(() => {
    const q = draft.trim().toLowerCase()
    return suggestions
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8)
  }, [draft, suggestions, value])

  const commit = (raw: string) => {
    const next = raw.trim()
    if (!next) return
    if (value.some((v) => v.toLowerCase() === next.toLowerCase())) {
      setDraft('')
      return
    }
    if (max && value.length >= max) return
    onChange([...value, next])
    setDraft('')
    setHighlight(0)
  }

  React.useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex min-h-[34px] flex-wrap items-center gap-1 rounded-md border border-line bg-panel px-1.5 py-1 shadow-xs',
          'transition-[border-color,box-shadow] duration-100 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 hover:border-line-strong',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex max-w-full items-center gap-1 rounded border border-line bg-subtle py-px pl-1.5 pr-1 text-2xs font-medium text-fg"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="rounded-sm p-0.5 text-faint transition-colors hover:bg-raised hover:text-fg"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          aria-label={ariaLabel}
          value={draft}
          placeholder={value.length === 0 ? placeholder : ''}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && draft.trim() && open && available[highlight])) {
              if (e.key === 'Tab' && !draft.trim()) return
              e.preventDefault()
              commit(open && available[highlight] && draft.trim() ? (available[highlight] as string) : draft)
              return
            }
            if (e.key === 'Backspace' && !draft && value.length > 0) {
              onChange(value.slice(0, -1))
              return
            }
            if (e.key === 'ArrowDown' && available.length > 0) {
              e.preventDefault()
              setOpen(true)
              setHighlight((h) => (h + 1) % available.length)
              return
            }
            if (e.key === 'ArrowUp' && available.length > 0) {
              e.preventDefault()
              setHighlight((h) => (h - 1 + available.length) % available.length)
              return
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          className="h-6 min-w-[7rem] flex-1 bg-transparent px-1 text-base outline-none placeholder:text-faint"
        />
      </div>
      {open && available.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-52 overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-lg animate-scale-in"
        >
          {available.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(s)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-base',
                  i === highlight ? 'bg-subtle text-fg' : 'text-muted',
                )}
              >
                <Plus className="h-3 w-3 shrink-0 text-faint" />
                <span className="truncate">{s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* -------------------------------- ListEditor ------------------------------ */

/** A simple ordered list of free-text lines (interview questions, etc.). */
export function ListEditor({
  value,
  onChange,
  placeholder,
  addLabel = 'Add item',
  ariaLabel,
}: {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  addLabel?: string
  ariaLabel: string
}) {
  const [draft, setDraft] = React.useState('')
  const add = () => {
    const next = draft.trim()
    if (!next) return
    onChange([...value, next])
    setDraft('')
  }
  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <ul className="space-y-1" aria-label={ariaLabel}>
          {value.map((item, i) => (
            <li key={`${item}-${i}`} className="group flex items-start gap-2 rounded-md border border-line bg-subtle px-2 py-1.5">
              <span className="mt-px w-4 shrink-0 text-right text-2xs tabular-nums text-faint">{i + 1}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">{item}</span>
              <button
                type="button"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity hover:bg-raised hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          aria-label={addLabel}
          className="h-8"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-line bg-panel px-2.5 text-sm font-medium text-fg shadow-xs transition-colors hover:bg-subtle disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  )
}
