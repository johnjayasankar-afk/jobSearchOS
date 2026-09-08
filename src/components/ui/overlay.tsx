import * as React from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import * as RDropdown from '@radix-ui/react-dropdown-menu'
import * as RPopover from '@radix-ui/react-popover'
import * as RTooltip from '@radix-ui/react-tooltip'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, IconButton } from './primitives'

const OVERLAY_CLASS =
  'fixed inset-0 z-50 bg-[hsl(var(--shadow)/0.32)] backdrop-blur-[1px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out'

/* --------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  /** Set when the dialog owns its own scroll region (e.g. long forms). */
  bodyClassName,
  initialFocusRef,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  bodyClassName?: string
  initialFocusRef?: React.RefObject<HTMLElement>
}) {
  const widths = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={OVERLAY_CLASS} />
        <RDialog.Content
          onOpenAutoFocus={(event) => {
            // Focus the field the dialog is really about, or the dialog itself.
            // Letting focus land on the close button puts a bright ring on the
            // one control the user is least likely to want.
            event.preventDefault()
            const target = initialFocusRef?.current ?? (event.currentTarget as HTMLElement)
            target.focus({ preventScroll: true })
          }}
          tabIndex={-1}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[min(90vh,calc(100dvh-2rem))] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'overflow-hidden rounded-xl border border-line bg-panel shadow-xl',
            'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
            widths[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <RDialog.Title className="text-md font-semibold tracking-[-0.01em] text-fg">{title}</RDialog.Title>
              {description && (
                <RDialog.Description className="text-sm leading-relaxed text-muted">
                  {description}
                </RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <IconButton label="Close" size="sm" className="-mr-1 -mt-0.5 shrink-0">
                <X />
              </IconButton>
            </RDialog.Close>
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-4', bodyClassName)}>{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-line bg-subtle/60 px-4 py-3">
              {footer}
            </div>
          )}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/* ---------------------------------- Sheet --------------------------------- */

/** Right-hand side panel. Full-screen below the `sm` breakpoint. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  width = 'lg',
  header,
  label,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible title; pass `header` to render a custom visual header. */
  title: string
  children: React.ReactNode
  width?: 'md' | 'lg' | 'xl'
  header?: React.ReactNode
  label?: string
}) {
  const widths = {
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  }
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={OVERLAY_CLASS} />
        <RDialog.Content
          aria-label={label ?? title}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-panel shadow-xl outline-none',
            'data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
            widths[width],
          )}
        >
          <RDialog.Title className="sr-only">{title}</RDialog.Title>
          {header}
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

export const SheetClose = RDialog.Close

/* ----------------------------- ConfirmDialog ------------------------------ */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  /** When set, the user must type this exact string to enable confirmation. */
  typeToConfirm,
  /** Blocks confirmation while the body's own input is incomplete. */
  confirmDisabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
  typeToConfirm?: string
  confirmDisabled?: boolean
}) {
  const [busy, setBusy] = React.useState(false)
  const [typed, setTyped] = React.useState('')
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const blocked = (Boolean(typeToConfirm) && typed.trim() !== typeToConfirm) || Boolean(confirmDisabled)

  return (
    <RDialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <RDialog.Portal>
        <RDialog.Overlay className={OVERLAY_CLASS} />
        <RDialog.Content
          ref={contentRef}
          role="alertdialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            // A dialog that asks for something should land in the field that
            // asks for it; only a bare confirmation starts on Cancel, so that
            // a stray Return never destroys anything.
            const field = contentRef.current?.querySelector<HTMLElement>(
              'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
            )
            ;(field ?? cancelRef.current)?.focus()
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-line bg-panel p-4 shadow-xl',
            'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
          )}
        >
          <RDialog.Title className="text-md font-semibold text-fg">{title}</RDialog.Title>
          <RDialog.Description asChild>
            <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-muted">{body}</div>
          </RDialog.Description>
          {typeToConfirm && (
            <div className="mt-3 space-y-1.5">
              <label htmlFor="confirm-phrase" className="label">
                Type <span className="font-mono text-fg">{typeToConfirm}</span> to continue
              </label>
              <input
                id="confirm-phrase"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="field"
              />
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button ref={cancelRef} variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              loading={busy}
              disabled={blocked}
              onClick={async () => {
                setBusy(true)
                try {
                  await onConfirm()
                  onOpenChange(false)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/* ---------------------------------- Menu ---------------------------------- */

export const Menu = RDropdown.Root
export const MenuTrigger = RDropdown.Trigger

export function MenuContent({
  children,
  align = 'end',
  className,
  sideOffset = 6,
}: {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  sideOffset?: number
}) {
  return (
    <RDropdown.Portal>
      <RDropdown.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-50 max-h-[min(26rem,var(--radix-dropdown-menu-content-available-height))] min-w-[11rem] overflow-y-auto',
          'rounded-lg border border-line bg-panel p-1 shadow-lg',
          'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
          className,
        )}
      >
        {children}
      </RDropdown.Content>
    </RDropdown.Portal>
  )
}

export function MenuItem({
  children,
  onSelect,
  icon,
  shortcut,
  destructive,
  disabled,
  className,
}: {
  children: React.ReactNode
  onSelect?: () => void
  icon?: React.ReactNode
  shortcut?: string
  destructive?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <RDropdown.Item
      disabled={disabled}
      // No preventDefault here: choosing an item should close the menu. Radix
      // returns focus to the trigger, and any dialog opened by the handler
      // takes focus from there.
      onSelect={() => onSelect?.()}
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-base outline-none',
        'data-[highlighted]:bg-subtle data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        destructive ? 'text-critical data-[highlighted]:bg-critical-soft' : 'text-fg',
        className,
      )}
    >
      {icon && <span className="shrink-0 text-faint [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <span className="shrink-0 text-2xs tabular-nums text-faint">{shortcut}</span>}
    </RDropdown.Item>
  )
}

export function MenuCheckItem({
  children,
  checked,
  onChange,
  icon,
}: {
  children: React.ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  icon?: React.ReactNode
}) {
  return (
    <RDropdown.CheckboxItem
      checked={checked}
      onCheckedChange={onChange}
      onSelect={(e) => e.preventDefault()}
      className="flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-base text-fg outline-none data-[highlighted]:bg-subtle"
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-line-strong data-[checked]:bg-accent">
        <RDropdown.ItemIndicator>
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-accent" aria-hidden>
            <path d="M2 6.5 4.5 9 10 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </RDropdown.ItemIndicator>
      </span>
      {icon && <span className="shrink-0 text-faint [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </RDropdown.CheckboxItem>
  )
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <RDropdown.Label className="px-2 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-faint">
      {children}
    </RDropdown.Label>
  )
}

export function MenuSeparator() {
  return <RDropdown.Separator className="my-1 h-px bg-line" />
}

export const MenuSub = RDropdown.Sub
export const MenuSubTrigger = ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => (
  <RDropdown.SubTrigger className="flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-base text-fg outline-none data-[highlighted]:bg-subtle data-[state=open]:bg-subtle">
    {icon && <span className="shrink-0 text-faint [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
    <span className="min-w-0 flex-1 truncate">{children}</span>
    <svg viewBox="0 0 12 12" className="h-3 w-3 text-faint" aria-hidden>
      <path d="m4.5 2.5 3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </RDropdown.SubTrigger>
)
export const MenuSubContent = ({ children }: { children: React.ReactNode }) => (
  <RDropdown.Portal>
    <RDropdown.SubContent
      sideOffset={4}
      collisionPadding={12}
      className="z-50 min-w-[10rem] rounded-lg border border-line bg-panel p-1 shadow-lg data-[state=open]:animate-scale-in"
    >
      {children}
    </RDropdown.SubContent>
  </RDropdown.Portal>
)

/* -------------------------------- Popover --------------------------------- */

export const Popover = RPopover.Root
export const PopoverTrigger = RPopover.Trigger
export const PopoverClose = RPopover.Close

export function PopoverContent({
  children,
  align = 'start',
  className,
  sideOffset = 6,
}: {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  sideOffset?: number
}) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-50 max-h-[min(28rem,var(--radix-popover-content-available-height))] overflow-y-auto rounded-lg border border-line bg-panel p-3 shadow-lg',
          'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
          className,
        )}
      >
        {children}
      </RPopover.Content>
    </RPopover.Portal>
  )
}

/* -------------------------------- Tooltip --------------------------------- */

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={350} skipDelayDuration={250}>
      {children}
    </RTooltip.Provider>
  )
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  className,
}: {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  if (!content) return <>{children}</>
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={10}
          className={cn(
            'z-[60] max-w-xs rounded-md border border-line bg-panel px-2 py-1 text-xs leading-relaxed text-fg shadow-md',
            'data-[state=delayed-open]:animate-fade-in',
            className,
          )}
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
