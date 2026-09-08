import * as React from 'react'
import { cn, formatDate } from '@/lib/utils'

/**
 * Inline fields that commit on blur. Editing an opportunity should never
 * require entering an "edit mode" or pressing Save — but a commit still only
 * happens when the value actually changed, so the activity log stays clean.
 */

export function InlineTextArea({
  value,
  onCommit,
  placeholder,
  label,
  rows = 3,
  className,
  id,
}: {
  value: string | undefined
  onCommit: (value: string | undefined) => void | Promise<void>
  placeholder: string
  label: string
  rows?: number
  className?: string
  id?: string
}) {
  const [draft, setDraft] = React.useState(value ?? '')
  const [focused, setFocused] = React.useState(false)
  const ref = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (!focused) setDraft(value ?? '')
  }, [value, focused])

  const resize = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, rows * 22)}px`
  }, [rows])

  React.useLayoutEffect(resize, [resize, draft])

  const commit = () => {
    setFocused(false)
    const next = draft.trim()
    if (next === (value ?? '').trim()) return
    void onCommit(next || undefined)
  }

  return (
    <textarea
      id={id}
      ref={ref}
      aria-label={label}
      value={draft}
      rows={rows}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setDraft(value ?? '')
          e.currentTarget.blur()
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur()
      }}
      className={cn(
        'w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1.5 text-base leading-relaxed text-fg',
        'transition-colors placeholder:text-faint hover:border-line hover:bg-subtle/60',
        'focus:border-accent focus:bg-panel focus:outline-none focus:ring-2 focus:ring-accent/25',
        className,
      )}
    />
  )
}

/**
 * A date that reads as text until you click it. Native empty date inputs show
 * "mm/dd/yyyy", which is noise in a page full of real values.
 */
export function InlineDate({
  value,
  onCommit,
  label,
  placeholder = 'Set a date',
  className,
  id,
}: {
  value: string | undefined
  onCommit: (value: string | undefined) => void | Promise<void>
  label: string
  placeholder?: string
  className?: string
  id?: string
}) {
  const [editing, setEditing] = React.useState(false)
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!editing) return
    ref.current?.focus()
    // showPicker is not implemented everywhere; focus alone is a fine fallback.
    try {
      ref.current?.showPicker?.()
    } catch {
      /* the field is focused either way */
    }
  }, [editing])

  if (editing) {
    return (
      <input
        id={id}
        ref={ref}
        type="date"
        aria-label={label}
        defaultValue={value ?? ''}
        onBlur={(e) => {
          setEditing(false)
          const next = e.target.value || undefined
          if (next !== value) void onCommit(next)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.currentTarget.value = value ?? ''
            setEditing(false)
          }
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={cn(
          'w-full rounded-md border border-accent bg-panel px-2 py-1 text-base tabular-nums text-fg outline-none ring-2 ring-accent/25',
          className,
        )}
      />
    )
  }

  return (
    <button
      id={id}
      type="button"
      aria-label={`${label}${value ? `: ${formatDate(value)}` : ', not set'}. Click to change`}
      onClick={() => setEditing(true)}
      className={cn(
        'w-full rounded-md border border-transparent px-2 py-1 text-left text-base tabular-nums transition-colors',
        'hover:border-line hover:bg-subtle/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
        value ? 'text-fg' : 'text-faint',
        className,
      )}
    >
      {value ? formatDate(value) : placeholder}
    </button>
  )
}

export function InlineInput({
  value,
  onCommit,
  placeholder,
  label,
  className,
  type = 'text',
  id,
  inputMode,
}: {
  value: string | undefined
  onCommit: (value: string | undefined) => void | Promise<void>
  placeholder: string
  label: string
  className?: string
  type?: 'text' | 'date' | 'number'
  id?: string
  inputMode?: 'text' | 'numeric' | 'url'
}) {
  const [draft, setDraft] = React.useState(value ?? '')
  const [focused, setFocused] = React.useState(false)

  React.useEffect(() => {
    if (!focused) setDraft(value ?? '')
  }, [value, focused])

  const commit = () => {
    setFocused(false)
    const next = draft.trim()
    if (next === (value ?? '').trim()) return
    void onCommit(next || undefined)
  }

  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setDraft(value ?? '')
          e.currentTarget.blur()
        }
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={cn(
        'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-base text-fg',
        'transition-colors placeholder:text-faint hover:border-line hover:bg-subtle/60',
        'focus:border-accent focus:bg-panel focus:outline-none focus:ring-2 focus:ring-accent/25',
        className,
      )}
    />
  )
}

/** A labelled block used throughout the detail workspace. */
export function EditBlock({
  label,
  children,
  hint,
  action,
  className,
}: {
  label: string
  children: React.ReactNode
  hint?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between gap-2 px-2">
        <h3 className="section-title">{label}</h3>
        {action}
      </div>
      {children}
      {hint && <p className="px-2 text-xs text-faint">{hint}</p>}
    </section>
  )
}
