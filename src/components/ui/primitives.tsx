import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import type { Tone } from '@/lib/types'

/* --------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'link'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const BUTTON_BASE =
  'relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,opacity] duration-100 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ' +
  'disabled:pointer-events-none disabled:opacity-45'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-xs hover:bg-accent/90 active:bg-accent/95 border border-transparent',
  secondary:
    'border border-line bg-panel text-fg shadow-xs hover:bg-subtle hover:border-line-strong active:bg-raised',
  subtle: 'border border-transparent bg-subtle text-fg hover:bg-raised',
  ghost: 'border border-transparent text-muted hover:bg-subtle hover:text-fg',
  danger:
    'border border-transparent bg-critical text-white shadow-xs hover:opacity-90 active:opacity-95',
  link: 'border-0 text-accent underline-offset-2 hover:underline px-0',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-xs rounded',
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-base',
  lg: 'h-9 px-4 text-md',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Renders an icon before the label; sized automatically. */
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, icon, iconRight, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        icon && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      )}
      {children}
      {iconRight && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{iconRight}</span>}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'iconRight'> {
  /** Required: icon-only controls must still be announced. */
  label: string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant = 'ghost', size = 'md', label, children, ...props },
  ref,
) {
  const sizes: Record<ButtonSize, string> = {
    xs: 'h-6 w-6 rounded',
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-9 w-9',
  }
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        sizes[size],
        'p-0 [&>svg]:h-4 [&>svg]:w-4',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})

/* --------------------------------- Badge ---------------------------------- */

const TONE_SOLID: Record<Tone, string> = {
  neutral: 'bg-subtle text-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent/25',
  positive: 'bg-positive-soft text-positive border-positive/25',
  caution: 'bg-caution-soft text-caution border-caution/25',
  critical: 'bg-critical-soft text-critical border-critical/25',
  info: 'bg-info-soft text-info border-info/25',
}

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-faint',
  accent: 'bg-accent',
  positive: 'bg-positive',
  caution: 'bg-caution',
  critical: 'bg-critical',
  info: 'bg-info',
}

export function Badge({
  tone = 'neutral',
  dot,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded border px-1.5 py-px text-2xs font-medium leading-[17px]',
        TONE_SOLID[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function Dot({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone], className)} aria-hidden />
}

/* ---------------------------------- Kbd ----------------------------------- */

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn('kbd', className)}>{children}</kbd>
}

/* --------------------------------- Avatar --------------------------------- */

const AVATAR_TONES = [
  'bg-[hsl(222_60%_92%)] text-[hsl(222_70%_35%)] dark:bg-[hsl(222_40%_22%)] dark:text-[hsl(222_80%_78%)]',
  'bg-[hsl(158_45%_90%)] text-[hsl(158_70%_24%)] dark:bg-[hsl(158_30%_18%)] dark:text-[hsl(158_60%_70%)]',
  'bg-[hsl(28_70%_92%)] text-[hsl(28_80%_32%)] dark:bg-[hsl(28_40%_20%)] dark:text-[hsl(30_85%_72%)]',
  'bg-[hsl(340_60%_93%)] text-[hsl(340_65%_38%)] dark:bg-[hsl(340_30%_21%)] dark:text-[hsl(340_75%_78%)]',
  'bg-[hsl(265_50%_93%)] text-[hsl(265_55%_42%)] dark:bg-[hsl(265_30%_22%)] dark:text-[hsl(265_65%_80%)]',
  'bg-[hsl(196_60%_91%)] text-[hsl(196_75%_28%)] dark:bg-[hsl(196_40%_18%)] dark:text-[hsl(196_70%_72%)]',
]

function toneIndex(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997
  return h % AVATAR_TONES.length
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    xs: 'h-5 w-5 text-[9px]',
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-7 w-7 text-2xs',
    lg: 'h-10 w-10 text-sm',
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase tracking-tight',
        sizes[size],
        AVATAR_TONES[toneIndex(name)],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

/* -------------------------------- Spinner --------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-faint', className)} aria-hidden />
}

/* ------------------------------ EmptyState -------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-6 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      {icon && (
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-subtle text-faint [&>svg]:h-4 [&>svg]:w-4"
          aria-hidden
        >
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-base font-medium text-fg">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-balance text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1 flex items-center gap-2">{action}</div>}
    </div>
  )
}

/* -------------------------------- Progress -------------------------------- */

export function Meter({
  value,
  max = 100,
  tone = 'accent',
  className,
  label,
}: {
  value: number
  max?: number
  tone?: Tone
  className?: string
  label?: string
}) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-raised', className)}
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', TONE_DOT[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ----------------------------- SegmentedControl --------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ariaLabel,
}: {
  options: Array<{ value: T; label: React.ReactNode; title?: string }>
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-line bg-subtle p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            // A text option names itself. An icon-only one has nothing but the
            // tooltip, which is the weakest source of an accessible name, so it
            // is promoted to a real label.
            aria-label={typeof option.label === 'string' ? undefined : option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors duration-100',
              size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
              selected
                ? 'bg-panel text-fg shadow-xs ring-1 ring-line'
                : 'text-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------- Separator ------------------------------- */

export function Separator({
  orientation = 'horizontal',
  className,
}: {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    />
  )
}

/* --------------------------------- Skeleton ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded bg-subtle', className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-raised to-transparent" />
    </div>
  )
}
