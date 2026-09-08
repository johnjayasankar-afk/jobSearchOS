import * as React from 'react'
import { BookMarked, Ear, Plus, Search, Star, X } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { Badge, Button, EmptyState, Segmented } from '@/components/ui/primitives'
import { Tooltip } from '@/components/ui/overlay'
import { Readiness } from '@/components/stories/Readiness'
import { SHARPNESS_META, formatSeconds, sharpnessOf, typicalSeconds, type Sharpness } from '@/lib/rehearsal'
import { MultiFilter } from '@/components/opportunity/FilterBar'
import { useAppUi } from '@/state/app-ui'
import { useWorkspace } from '@/state/workspace'
import { useDebounced } from '@/hooks/useHotkeys'
import { searchStories, storyCompleteness } from '@/lib/stories'
import { updateStory } from '@/lib/repo'
import { STORY_TAGS, type Story } from '@/lib/types'
import { cn, formatAgo, pluralize, truncate } from '@/lib/utils'

type SortId = 'recent' | 'used' | 'title'
type ViewId = 'library' | 'readiness'

export function StoriesPage() {
  const ui = useAppUi()
  const workspace = useWorkspace()
  const [query, setQuery] = React.useState('')
  const [tags, setTags] = React.useState<string[]>([])
  const [favoritesOnly, setFavoritesOnly] = React.useState(false)
  const [sort, setSort] = React.useState<SortId>('recent')
  const [view, setView] = React.useState<ViewId>('library')
  const debounced = useDebounced(query, 140)

  const filtered = React.useMemo(() => {
    let list = searchStories(workspace.stories, debounced)
    if (tags.length > 0) list = list.filter((s) => tags.every((t) => s.tags.includes(t)))
    if (favoritesOnly) list = list.filter((s) => s.favorite)
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'used') return b.useCount - a.useCount || b.updatedAt.localeCompare(a.updatedAt)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [workspace.stories, debounced, tags, favoritesOnly, sort])

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Story Bank"
        description="Reusable answers, written once and kept sharp."
        actions={
          <div className="flex items-center gap-2">
            <Segmented<ViewId>
              ariaLabel="Story bank view"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'library', label: 'Library' },
                { value: 'readiness', label: 'Readiness' },
              ]}
            />
            {workspace.stories.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Ear />}
                onClick={() => ui.openRehearsal()}
              >
                <span className="hidden sm:inline">Rehearse</span>
              </Button>
            )}
            <Button size="sm" variant="primary" icon={<Plus />} onClick={() => ui.openStoryEditor()}>
              <span className="hidden sm:inline">New story</span>
            </Button>
          </div>
        }
      >
        {workspace.stories.length > 0 && view === 'library' && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
            <div className="relative min-w-[11rem] flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stories…"
                aria-label="Search stories"
                className="h-8 w-full rounded-md border border-line bg-panel pl-8 pr-8 text-base text-fg shadow-xs transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-faint transition-colors hover:bg-subtle hover:text-fg"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <MultiFilter
              label="Themes"
              value={tags}
              onChange={setTags}
              options={STORY_TAGS.map((t) => ({ value: t, label: t }))}
            />

            <button
              type="button"
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((f) => !f)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium shadow-xs transition-colors',
                favoritesOnly
                  ? 'border-caution/40 bg-caution-soft text-caution'
                  : 'border-line bg-panel text-muted hover:border-line-strong hover:text-fg',
              )}
            >
              <Star className={cn('h-3.5 w-3.5', favoritesOnly && 'fill-current')} aria-hidden />
              Favourites
            </button>

            <Segmented<SortId>
              ariaLabel="Sort stories"
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'recent', label: 'Recent' },
                { value: 'used', label: 'Most used' },
                { value: 'title', label: 'A–Z' },
              ]}
            />

            <p className="ml-auto whitespace-nowrap text-xs tabular-nums text-faint">
              {filtered.length} {pluralize(filtered.length, 'story', 'stories')}
            </p>
          </div>
        )}
      </PageHeader>

      <p aria-live="polite" className="sr-only">
        {`${filtered.length} ${pluralize(filtered.length, 'story', 'stories')} in view`}
      </p>

      {view === 'readiness' ? (
        <Readiness />
      ) : workspace.stories.length === 0 ? (
        <EmptyState
          icon={<BookMarked />}
          title="No stories yet"
          description="Write your best five or six once, in situation–task–action–result form. Interview prep then becomes picking, not remembering."
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => ui.openStoryEditor()}>
              Write your first story
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="No stories match"
          description="Try a different theme or clear the search."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('')
                setTags([])
                setFavoritesOnly(false)
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 px-4 py-5 sm:px-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  )
}

const SHARPNESS_TONE: Record<Sharpness, string> = {
  sharp: 'text-positive',
  fading: 'text-muted',
  shaky: 'text-caution',
  untested: 'text-faint',
}

function SharpnessChip({ story }: { story: Story }) {
  const state = sharpnessOf(story)
  return (
    <Tooltip content={SHARPNESS_META[state].hint}>
      <span className={cn('font-medium', SHARPNESS_TONE[state])}>{SHARPNESS_META[state].label}</span>
    </Tooltip>
  )
}

function StoryCard({ story }: { story: Story }) {
  const ui = useAppUi()
  const completeness = storyCompleteness(story)
  const preview = story.result?.trim() || story.action?.trim() || story.situation?.trim() || ''

  return (
    <article className="group relative flex flex-col rounded-lg border border-line bg-panel p-3.5 transition-shadow hover:shadow-sm">
      <Tooltip content="Rehearse this story">
        <button
          type="button"
          aria-label={`Rehearse ${story.title}`}
          onClick={(e) => {
            e.stopPropagation()
            ui.openRehearsal({ storyId: story.id })
          }}
          className="absolute right-9 top-2.5 rounded p-1 text-faint opacity-0 transition-colors hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Ear className="h-3.5 w-3.5" />
        </button>
      </Tooltip>

      <button
        type="button"
        aria-pressed={story.favorite}
        aria-label={story.favorite ? `Remove ${story.title} from favourites` : `Mark ${story.title} as a favourite`}
        onClick={(e) => {
          e.stopPropagation()
          void updateStory(story.id, { favorite: !story.favorite })
        }}
        className={cn(
          'absolute right-2.5 top-2.5 rounded p-1 transition-colors',
          story.favorite ? 'text-caution' : 'text-faint opacity-0 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100',
        )}
      >
        <Star className={cn('h-3.5 w-3.5', story.favorite && 'fill-current')} />
      </button>

      <button
        type="button"
        onClick={() => ui.openStoryEditor(story)}
        className="flex min-h-0 flex-1 flex-col text-left"
      >
        <h3 className="pr-6 text-balance text-md font-medium leading-snug text-fg">{story.title}</h3>
        {preview && (
          <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">{truncate(preview, 190)}</p>
        )}
        {story.metrics && (
          <p className="mt-2 truncate text-xs font-medium tabular-nums text-positive" title={story.metrics}>
            {story.metrics}
          </p>
        )}
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {story.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} tone="accent">
            {tag}
          </Badge>
        ))}
        {story.tags.length > 3 && <span className="text-2xs text-faint">+{story.tags.length - 3}</span>}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-2xs text-faint">
        <span className="flex items-center gap-1.5">
          <SharpnessChip story={story} />
          <span aria-hidden>·</span>
          <span>
            {completeness.filled === completeness.total
              ? 'Complete'
              : `${completeness.filled}/${completeness.total} sections`}
          </span>
        </span>
        <span className="tabular-nums">
          {(() => {
            const usual = typicalSeconds(story)
            if (usual !== null) return `Usually ${formatSeconds(usual)}`
            return story.useCount === 0
              ? 'Not used yet'
              : `Used ${story.useCount}×${story.lastUsedAt ? ` · ${formatAgo(story.lastUsedAt)}` : ''}`
          })()}
        </span>
      </div>
    </article>
  )
}
