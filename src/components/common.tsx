import * as React from 'react'
import { AlertCircle, Check, ChevronDown, CircleHelp, Minus, TrendingUp } from 'lucide-react'
import {
  PRIORITY_META,
  STAGES,
  STAGE_META,
  type Priority,
  type Stage,
  type Tone,
} from '@/lib/types'
import type { FitResult } from '@/lib/fit'
import { cn, daysFromToday, formatRelativeDay } from '@/lib/utils'
import { Badge, Dot } from './ui/primitives'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tooltip } from './ui/overlay'

/* ------------------------------- Company mark ----------------------------- */

export function CompanyMark({ company, size = 'md' }: { company: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-5 w-5 rounded-[4px] text-[10px]',
    md: 'h-6 w-6 rounded-[5px] text-[11px]',
    lg: 'h-9 w-9 rounded-lg text-sm',
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center border border-line bg-subtle font-semibold uppercase text-muted',
        sizes[size],
      )}
    >
      {company.trim().charAt(0) || '·'}
    </span>
  )
}

/* --------------------------------- Stage ---------------------------------- */

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  const meta = STAGE_META[stage]
  return (
    <Badge tone={meta.tone} dot className={className}>
      {meta.label}
    </Badge>
  )
}

export function StagePicker({
  stage,
  onChange,
  disabled,
  align = 'start',
  className,
}: {
  stage: Stage
  onChange: (stage: Stage) => void
  disabled?: boolean
  align?: 'start' | 'end'
  className?: string
}) {
  const groups: Array<{ label: string; stages: Stage[] }> = [
    { label: 'Exploring', stages: STAGES.filter((s) => STAGE_META[s].group === 'exploring') },
    { label: 'Applying', stages: STAGES.filter((s) => STAGE_META[s].group === 'applying') },
    { label: 'Interviewing', stages: STAGES.filter((s) => STAGE_META[s].group === 'interviewing') },
    { label: 'Closed', stages: STAGES.filter((s) => STAGE_META[s].group === 'closed') },
  ]
  const meta = STAGE_META[stage]
  return (
    <Menu>
      <MenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-line bg-panel px-2 text-sm font-medium text-fg shadow-xs',
            'transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            'disabled:pointer-events-none disabled:opacity-50',
            className,
          )}
          aria-label={`Stage: ${meta.label}. Change stage`}
        >
          <Dot tone={meta.tone} />
          <span className="truncate">{meta.label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-faint" />
        </button>
      </MenuTrigger>
      <MenuContent align={align} className="min-w-[13rem]">
        {groups.map((group, i) => (
          <React.Fragment key={group.label}>
            {i > 0 && <MenuSeparator />}
            <MenuLabel>{group.label}</MenuLabel>
            {group.stages.map((s) => (
              <MenuItem
                key={s}
                icon={<Dot tone={STAGE_META[s].tone} />}
                onSelect={() => onChange(s)}
                className={s === stage ? 'font-medium' : undefined}
              >
                <span className="flex items-center justify-between gap-2">
                  {STAGE_META[s].label}
                  {s === stage && <Check className="h-3.5 w-3.5 text-accent" />}
                </span>
              </MenuItem>
            ))}
          </React.Fragment>
        ))}
      </MenuContent>
    </Menu>
  )
}

/* -------------------------------- Priority -------------------------------- */

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const meta = PRIORITY_META[priority]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-muted', className)}
      title={`${meta.label} priority`}
    >
      <PriorityGlyph priority={priority} />
      {meta.label}
    </span>
  )
}

export function PriorityGlyph({ priority, className }: { priority: Priority; className?: string }) {
  const bars = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1
  const tone = PRIORITY_META[priority].tone
  const color =
    tone === 'critical' ? 'bg-critical' : tone === 'caution' ? 'bg-caution' : 'bg-line-strong'
  return (
    <span
      className={cn('inline-flex h-3 items-end gap-[2px]', className)}
      aria-hidden
      title={`${PRIORITY_META[priority].label} priority`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'w-[3px] rounded-[1px] transition-colors',
            i === 0 ? 'h-1.5' : i === 1 ? 'h-2.5' : 'h-3',
            i < bars ? color : 'bg-line',
          )}
        />
      ))}
    </span>
  )
}

export function PriorityPicker({
  priority,
  onChange,
  className,
}: {
  priority: Priority
  onChange: (priority: Priority) => void
  className?: string
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Priority: ${PRIORITY_META[priority].label}. Change priority`}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-panel px-2 text-sm font-medium text-fg shadow-xs',
            'transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            className,
          )}
        >
          <PriorityGlyph priority={priority} />
          <span>{PRIORITY_META[priority].label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-faint" />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        {(['high', 'medium', 'low'] as Priority[]).map((p) => (
          <MenuItem key={p} icon={<PriorityGlyph priority={p} />} onSelect={() => onChange(p)}>
            <span className="flex items-center justify-between gap-2">
              {PRIORITY_META[p].label}
              {p === priority && <Check className="h-3.5 w-3.5 text-accent" />}
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

/* ---------------------------------- Fit ----------------------------------- */

const FIT_TONE_TEXT: Record<FitResult['tone'], string> = {
  positive: 'text-positive',
  accent: 'text-accent',
  caution: 'text-caution',
  critical: 'text-critical',
  neutral: 'text-faint',
}

export function FitScore({
  fit,
  size = 'md',
  showBand,
  className,
}: {
  fit: FitResult | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showBand?: boolean
  className?: string
}) {
  if (!fit || fit.score === null) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm text-faint', className)} title="Not enough profile data to score this role">
        <Minus className="h-3 w-3" aria-hidden />
        <span className="sr-only">Not scored</span>
      </span>
    )
  }
  const sizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  }
  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      <span className={cn('font-semibold tabular-nums', sizes[size], FIT_TONE_TEXT[fit.tone])}>
        {fit.score}
      </span>
      {fit.confidence === 'low' && (
        <span className="text-2xs text-faint" title="Provisional — based on limited information">
          ?
        </span>
      )}
      {showBand && <span className="truncate text-xs text-muted">{fit.band}</span>}
    </span>
  )
}

/** A compact bar + number used in dense table rows. */
export function FitCell({ fit }: { fit: FitResult | null | undefined }) {
  if (!fit || fit.score === null) {
    return (
      <Tooltip content="Add target roles and skills to your Master Profile to score fit.">
        <span className="inline-flex items-center text-sm text-faint">—</span>
      </Tooltip>
    )
  }
  const barColor =
    fit.tone === 'positive'
      ? 'bg-positive'
      : fit.tone === 'accent'
        ? 'bg-accent'
        : fit.tone === 'caution'
          ? 'bg-caution'
          : 'bg-critical'
  return (
    <Tooltip content={`${fit.band} · ${Math.round(fit.coverage * 100)}% of the score is based on recorded data`}>
      <span className="inline-flex items-center gap-2">
        <span className={cn('w-6 text-right text-sm font-semibold tabular-nums', FIT_TONE_TEXT[fit.tone])}>
          {fit.score}
        </span>
        <span className="h-1 w-10 overflow-hidden rounded-full bg-raised" aria-hidden>
          <span className={cn('block h-full rounded-full', barColor)} style={{ width: `${fit.score}%` }} />
        </span>
      </span>
    </Tooltip>
  )
}

/** The full explanation: components, matches and gaps. */
export function FitBreakdown({ fit, className }: { fit: FitResult; className?: string }) {
  if (fit.score === null) {
    return (
      <div className={cn('rounded-lg border border-dashed border-line bg-subtle/60 p-4', className)}>
        <p className="text-base font-medium text-fg">Fit scoring is off</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Opportunity OS scores a role against your Master Profile. Nothing is inferred — fill in your
          target roles, skills and compensation floor and every opportunity gets a transparent score.
        </p>
        {fit.improveHints.length > 0 && (
          <ul className="mt-2 space-y-1">
            {fit.improveHints.map((hint) => (
              <li key={hint} className="flex gap-2 text-sm text-muted">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" aria-hidden />
                {hint}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 items-baseline gap-1">
          <span className={cn('text-3xl font-semibold tabular-nums tracking-tight', FIT_TONE_TEXT[fit.tone])}>
            {fit.score}
          </span>
          <span className="text-sm text-faint">/ 100</span>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-base font-medium text-fg">{fit.band}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {Math.round(fit.coverage * 100)}% of the scoring weight could be evaluated from what you have
            recorded.{' '}
            {fit.confidence !== 'high' && 'Components without data are excluded rather than scored as zero.'}
          </p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {fit.components.map((component) => {
          const pct = component.earned === null ? 0 : (component.earned / component.weight) * 100
          const unknown = component.earned === null
          return (
            <li key={component.id} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
              <span className="truncate text-sm text-muted" title={component.label}>
                {component.label}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden>
                {!unknown && (
                  <span
                    className={cn(
                      'block h-full rounded-full transition-[width] duration-500',
                      pct >= 80 ? 'bg-positive' : pct >= 50 ? 'bg-accent' : pct >= 25 ? 'bg-caution' : 'bg-critical',
                    )}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                )}
              </span>
              <Tooltip content={component.note}>
                <span className="w-16 text-right text-xs tabular-nums text-muted">
                  {unknown ? (
                    <span className="inline-flex items-center gap-1 text-faint">
                      <CircleHelp className="h-3 w-3" aria-hidden />
                      n/a
                    </span>
                  ) : (
                    `${component.earned} / ${component.weight}`
                  )}
                </span>
              </Tooltip>
            </li>
          )
        })}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <FitList title="Matches" tone="positive" items={fit.matches} emptyLabel="No direct matches yet." />
        <FitList title="Gaps" tone="caution" items={fit.gaps} emptyLabel="No gaps recorded." />
      </div>

      {fit.improveHints.length > 0 && (
        <div className="rounded-md border border-line bg-subtle/70 p-2.5">
          <p className="text-xs font-medium text-fg">Make this score more reliable</p>
          <ul className="mt-1 space-y-0.5">
            {fit.improveHints.map((hint) => (
              <li key={hint} className="text-xs leading-relaxed text-muted">
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FitList({
  title,
  tone,
  items,
  emptyLabel,
}: {
  title: string
  tone: 'positive' | 'caution'
  items: string[]
  emptyLabel: string
}) {
  return (
    <div>
      <p className="section-title">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-sm text-faint">{emptyLabel}</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {items.slice(0, 8).map((item) => (
            <li key={item} className="flex gap-1.5 text-sm leading-snug text-fg">
              {tone === 'positive' ? (
                <Check className="mt-[3px] h-3 w-3 shrink-0 text-positive" aria-hidden />
              ) : (
                <AlertCircle className="mt-[3px] h-3 w-3 shrink-0 text-caution" aria-hidden />
              )}
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------- Due dates -------------------------------- */

export function DueDate({
  date,
  className,
  prefix,
}: {
  date: string | undefined
  className?: string
  prefix?: string
}) {
  if (!date) return <span className={cn('text-sm text-faint', className)}>—</span>
  const days = daysFromToday(date)
  const tone =
    days === null ? 'text-muted' : days < 0 ? 'text-critical' : days === 0 ? 'text-caution' : days <= 3 ? 'text-fg' : 'text-muted'
  return (
    <span className={cn('whitespace-nowrap text-sm tabular-nums', tone, className)}>
      {prefix}
      {formatRelativeDay(date)}
    </span>
  )
}

/* ------------------------------ Page scaffolding -------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  children,
  sticky = true,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  sticky?: boolean
}) {
  return (
    <header
      className={cn(
        'z-20 border-b border-line bg-bg/85 backdrop-blur-sm',
        sticky && 'sticky top-0',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-[-0.012em] text-fg">{title}</h1>
          {description && <p className="mt-0.5 truncate text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

export function SectionHeader({
  title,
  count,
  action,
  className,
  icon,
}: {
  title: string
  count?: number
  action?: React.ReactNode
  className?: string
  icon?: React.ReactNode
}) {
  return (
    <div className={cn('flex min-h-[28px] items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.06em] text-faint">
        {icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
        {title}
        {count !== undefined && <span className="tabular-nums text-faint/80">{count}</span>}
      </h2>
      {action}
    </div>
  )
}

/* -------------------------------- Stat tile ------------------------------- */

export function Stat({
  label,
  value,
  sub,
  delta,
  tone,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  delta?: number
  tone?: Tone
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="truncate text-xs text-muted">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={cn(
            'text-xl font-semibold tabular-nums tracking-tight',
            tone === 'positive' ? 'text-positive' : tone === 'critical' ? 'text-critical' : 'text-fg',
          )}
        >
          {value}
        </span>
        {delta !== undefined && delta !== 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs tabular-nums',
              delta > 0 ? 'text-positive' : 'text-muted',
            )}
          >
            <TrendingUp className={cn('h-3 w-3', delta < 0 && 'rotate-180')} aria-hidden />
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </div>
      {sub && <p className="mt-0.5 truncate text-xs text-faint">{sub}</p>}
    </div>
  )
}
