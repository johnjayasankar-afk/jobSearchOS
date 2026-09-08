import * as React from 'react'
import { Bookmark, Check, Copy, Share2, TerminalSquare } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { buildBookmarklet } from '@/lib/capture'
import { copyText } from '@/lib/utils'

/**
 * Getting a job into the tracker is the step people skip, so the app meets the
 * browser where the posting already is. Both routes are plain links — no
 * extension, no permissions, no page ever fetched by the app.
 */
export function CaptureSection() {
  const toast = useToast()
  const [copied, setCopied] = React.useState(false)
  const appUrl = typeof window === 'undefined' ? '' : window.location.href
  const bookmarklet = React.useMemo(() => buildBookmarklet(appUrl), [appUrl])
  const exampleLink = `${(appUrl.split('#')[0] ?? appUrl)}#/add?company=Halcyon%20Pay&role=Senior%20Product%20Manager`

  return (
    <section>
      <h2 className="text-md font-semibold text-fg">Capture from anywhere</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
        Adding a role should take one click from the posting itself. Both routes below open the normal Add
        dialog with the company, role and link filled in — the page is read by your browser, in the tab you
        are already looking at, and nothing is sent anywhere.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col rounded-lg border border-line bg-panel p-3.5">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-muted" aria-hidden />
            <h3 className="text-base font-medium text-fg">Bookmarklet</h3>
          </div>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">
            Drag the button below onto your bookmarks bar. On any job posting, click it and Opportunity OS
            opens with the details ready to save.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Dragging is the supported way to install this; browsers block a
                click on a javascript: link, so the button says so. */}
            <a
              href={bookmarklet}
              draggable
              onClick={(e) => {
                e.preventDefault()
                toast.toast({
                  title: 'Drag it, do not click it',
                  description: 'Browsers block javascript links when clicked. Drag it to your bookmarks bar.',
                })
              }}
              className="inline-flex h-8 cursor-grab items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-3 text-sm font-medium text-accent shadow-xs active:cursor-grabbing"
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden />
              Save to Opportunity OS
            </a>
            <Button
              size="sm"
              variant="ghost"
              icon={copied ? <Check /> : <Copy />}
              onClick={async () => {
                const ok = await copyText(bookmarklet)
                if (ok) {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2000)
                  toast.success('Bookmarklet copied', 'Create a bookmark and paste this as its address.')
                } else {
                  toast.error('Could not reach the clipboard', 'Select the code below and copy it manually.')
                }
              }}
            >
              {copied ? 'Copied' : 'Copy the code'}
            </Button>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted">What it does</summary>
            <p className="mt-1.5 text-xs leading-relaxed text-faint">
              It reads <code className="font-mono text-fg">location.href</code> and{' '}
              <code className="font-mono text-fg">document.title</code> from the tab you are on and opens this
              app with them as parameters. That is the whole script.
            </p>
            <pre className="mt-1.5 max-h-24 overflow-auto rounded border border-line bg-subtle p-2 text-2xs leading-relaxed text-muted">
              {decodeURIComponent(bookmarklet.replace(/^javascript:/, ''))}
            </pre>
          </details>
        </div>

        <div className="flex flex-col rounded-lg border border-line bg-panel p-3.5">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-muted" aria-hidden />
            <h3 className="text-base font-medium text-fg">Share sheet</h3>
          </div>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">
            Install Opportunity OS as an app and it appears in your system share sheet. Share a job posting
            from your phone's browser and it arrives here ready to save. Available on Android and desktop
            Chrome or Edge; iOS does not offer share targets to web apps.
          </p>
          <p className="mt-3 text-xs text-faint">
            Install from the browser's address bar, or Share → Add to Home Screen on mobile.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-line bg-subtle/60 p-3.5">
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-3.5 w-3.5 text-muted" aria-hidden />
          <h3 className="text-sm font-medium text-fg">Or build a link yourself</h3>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Any link in this shape opens the capture dialog. Useful from a script, a note-taking app or a
          shortcut.
        </p>
        <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded border border-line bg-panel px-2 py-1.5 font-mono text-2xs text-muted">
          {exampleLink}
        </code>
        <p className="mt-1.5 text-xs text-faint">
          Understood parameters: <span className="text-muted">url</span>, <span className="text-muted">title</span>,{' '}
          <span className="text-muted">company</span>, <span className="text-muted">role</span>,{' '}
          <span className="text-muted">source</span>.
        </p>
      </div>
    </section>
  )
}
