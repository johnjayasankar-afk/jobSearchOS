import { cn } from '@/lib/utils'

/** The product mark: three ascending bars, the tallest in the accent colour. */
export function AppMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-[7px] bg-[hsl(224_28%_10%)] dark:bg-[hsl(225_10%_16%)]',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="none">
        <rect x="1" y="12" width="5.5" height="10" rx="2.75" className="fill-[hsl(220_12%_42%)]" />
        <rect x="9.25" y="8" width="5.5" height="14" rx="2.75" className="fill-[hsl(220_12%_58%)]" />
        <rect x="17.5" y="2" width="5.5" height="20" rx="2.75" className="fill-[hsl(222_84%_62%)]" />
      </svg>
    </span>
  )
}
