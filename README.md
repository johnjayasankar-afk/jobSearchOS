# Opportunity OS

A private, local-first command centre for running a serious professional job search.

It replaces the spreadsheet, the Notion tracker, the folder of saved links, the networking sheet,
the interview notes and the behavioural-story doc with one application built around a single
question: **what should I do next?**

The lifecycle it models is Discover → Evaluate → Apply → Network → Interview → Follow Up → Offer.

---

## Running it

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then produce `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the logic test suite on Node's built-in runner |
| `npm run icons` | Regenerate the PNG app icons from `scripts/generate-icons.mjs` |

The build output in `dist/` is a static site with relative asset paths and hash routing, so it can
be dropped onto any static host — including a subdirectory — with no server configuration.

---

## Privacy

There is no account server, no API and no telemetry. Every record lives in this browser's
IndexedDB, and the application makes no network request with your data — it works with the network
switched off. The only external thing it ever fetches is its own code.

The trade-off is real, and the app says so: clearing site data deletes the workspace. Settings →
Data exports everything as JSON (or opportunities and contacts as CSV) and restores it again, and
Today raises a dismissible reminder if a workspace worth losing has gone three weeks without an
export.

Settings → Safety can also ask the browser for persistent storage, which exempts the workspace from
eviction under storage pressure. The browser decides, and the answer is reported honestly — the app
never claims a guarantee it was not given.

---

## Architecture

```
src/
  lib/          Domain logic, no React
    types.ts            Entities, stages, enums and their display metadata
    db.ts               Dexie schema, versioning, defaults
    repo.ts             Data access: every mutation and its activity-log entry
    fit.ts              Transparent 0–100 fit scoring
    fit-cache.ts        Memoised scoring keyed on record + profile stamps
    parse.ts            Deterministic job-description parsing (regex only)
    agenda.ts           The action-priority engine behind Today
    analytics.ts        Funnel, conversion, time-in-stage, sample-size guards
    filtering.ts        Table filtering, sorting and column definitions
    duplicates.ts       "You may already be tracking this" detection
    templates.ts        Follow-up templates and variable substitution
    calendar.ts         RFC 5545 .ics generation for interviews
    stories.ts          Story suggestion matching
    csv.ts              RFC 4180 reader/writer, opportunity + contact mappings
    backup.ts           Export envelope, validation, restore, backup health
    snapshots.ts        In-browser restore points, pruning and storage persistence
    integrity.ts        Workspace consistency checks and their repairs
    capture.ts          Bookmarklet, share-target and deep-link capture
    offers.ts           First-year, steady-year and grant-lifetime offer maths
    decision.ts         Deciding on an offer: what matters, and where two differ
    starter-questions.ts  Curated question sets for engineering, design, data, marketing
    review.ts           The weekly review: what moved, what went quiet
    questions.ts        The question bank, resolving your own into it, and drills
    debrief.ts          What your own interviews have asked, counted from debriefs
    rehearsal.ts        How practised a story is, how long you take, when to chase
    fuzzy.ts            Subsequence matching and highlighting for the palette
    demo.ts             The demo workspace (loaded on demand)
  state/        React context providers (data, preferences, cross-page UI, undo)
  components/   UI primitives and feature components
  pages/        One file per section of the app
```

The rule the code follows: **anything that can be decided without React lives in `src/lib` and is
covered by tests.** Scoring, prioritisation, parsing, analytics, duplicate detection, templating,
calendar output, CSV and backup validation are all pure functions, which is why `npm test` covers
them without a browser.

### Data model notes

- Dates that mean "a day" are stored as `YYYY-MM-DD` and parsed at local midnight, so a due date
  never shifts across a timezone boundary.
- Every opportunity keeps a `stageHistory`. That is what lets the funnel count a record that was
  rejected after an onsite as having *reached* the onsite stage, rather than losing it.
- `DB_VERSION` in `db.ts` documents the migration pattern: v2 adds the message-template table, v3
  the snapshot store and v4 your own questions, all as worked examples. Fields added to an existing
  store — rehearsal runs, the outcome-asked stamp — need no version bump at all. Adding a field needs no version bump; changing
  indexes does.
- Seeding the built-in templates is guarded twice — by a timestamp and by an emptiness check — and
  serialised behind one promise, so overlapping callers cannot double-write.

---

## The parts worth knowing about

### Fit score

A weighted average of seven components (role 25, skills 25, domain 15, seniority 10, location 10,
compensation 10, preferences 5) compared against your Master Profile.

Components the workspace cannot evaluate — no job description, no stated salary, no profile entry —
are marked *unknown* and **excluded from the denominator** rather than scored as zero or guessed.
The UI reports what share of the weight was actually grounded in data, and calls a score with thin
coverage "provisional". Nothing is inferred about credentials you have not entered.

Scores are memoised on `(record.updatedAt, profile.updatedAt)`, so a workspace of hundreds of roles
re-scores only what actually changed.

### Job-description parsing

Pasting a posting fills in compensation, location, work arrangement and tags, and surfaces the
skills the posting names. This is regex and word-boundary matching against a fixed vocabulary,
running on your device. It is presented as editable suggestions with the matched text as evidence,
and it is never described as AI, because it isn't.

### Today

A deterministic priority engine. Each candidate action comes from a named rule with an explicit
score — overdue next action, interview within 72 hours with open prep, follow-up not recorded,
deadline approaching, application waiting past your threshold, contact gone quiet, and so on. The
`reason` shown under every action is the rule that fired. No more than two actions come from the
same opportunity, so one noisy record cannot fill the list.

### Follow-up composer

Networking reminders are worth little if the message still has to be written from scratch. The
composer drafts one from a template and the record in front of you — name, company, role, how long
the application has been sitting — leaves any placeholder it cannot fill visibly unfilled, and
tells you what is missing. Nothing is sent: you copy it out, and the dialog offers to log the
outreach so the follow-up clock resets. Templates ship as starting points and are fully editable in
Settings → Follow-ups.

### Interview prep sheet

One page per interview: who and when, the compensation and fit, why you want it, what you need to
find out, the questions likely to come and the ones you intend to ask, and the stories you decided
to tell — assembled from records you already keep. Printable, copyable as text, and exportable as a
calendar event.

### Compare

Select two to four opportunities and put them beside each other: stage, pay, location, fit and each
fit component, interviews held, people known, furthest stage reached. The only judgement the app
makes is marking the strongest cell in a row.

### Rehearsal

The story bank used to be write-only: somewhere to file an answer, with nothing
to say whether you could deliver it. Rehearsal closes that.

A fixed bank of 35 questions that recur in senior interviews is matched against
your stories by theme tag — no inference, no model. Each question carries a note
on what the interviewer is actually testing, which is editorial, written by hand.

Practising opens a room with one question, a clock, and your notes **hidden**,
because recalling the answer is the exercise. Stop the clock and the notes
reveal themselves next to the thing the question is probing for, so the verdict
you give — solid, or needs work — is a comparison rather than a feeling. That
verdict is the only judgement in the feature: nothing scores the answer itself.

The clock's number is kept too. Each run's length is stored with its verdict —
the last five, newest first — so a story can say how long you *usually* take on
it, and the moment after you stop shows this run against that. Running to three
minutes is the most common way a good answer stops landing, and it is the one
thing in the room that was already being measured and thrown away.

What you record comes back as *sharpness* — sharp, fading, needs work, untested —
on each story, in the interview prep sheet, and as a Today action when an
interview is close and its pinned stories have not been practised.

### Your own questions

The built-in bank was written from product-management interviews, and the app
says so rather than pretending it is universal. Settings → Questions lets you
add your own and set aside any that will never come up in your field; both
change the bank in force, and everything downstream — coverage, rehearsal, the
debrief checklist — takes that bank rather than the constant, so a question you
wrote counts exactly as much as one that shipped.

**If you are not a product manager**, Settings → Questions carries starter sets
for engineering, design, data and marketing — fourteen questions each, added as
*your own* so every one can be edited or thrown away, and removable as a group
because adding fourteen in one click and deleting them one at a time is not a
fair trade. The built-ins stay: most of what they ask about failure, conflict
and stakeholders applies anywhere, and the rest can be set aside individually.

The best source of them is the app itself. A debrief records questions the bank
does not carry, and the readiness map offers each one an **Add to bank** button
that opens the editor already filled in. Setting a question aside changes what
is offered, never what happened: a debrief that recorded it still counts it,
because that is a record rather than a preference.

### Recording what came of it

"Which round loses it" is only as good as the outcomes behind it, and the only
place to set one used to be an edit dialog nobody opens. Three things fixed
that: the debrief now asks *have you heard back* alongside how it felt (two
different questions, so both are asked); Today chases an interview that is ten
days old with no result; and a past interview awaiting a result carries a
**Result** button on its row.

The prompt treats "still waiting" as a real answer rather than a way to dismiss
the question — most of the time it is the truth — and stops asking for a week
afterwards. A question you cannot answer is just nagging.

### The debrief

Everything else in the app looks forward. The debrief is the one thing that
looks back, and it has a short shelf life — an hour after the call you can list
the questions, and three days later the honest answer is "it went fine", which
teaches nobody anything. So Today asks for it while the interview is still warm
and stops asking once the recall is worthless.

It asks for one thing above all: **what they actually asked**. The bank's
questions come pre-filtered to the format, so recording an interview is mostly
tapping; anything the bank does not carry goes in as free text, and those are
usually the questions specific to the company. Each one gets your own verdict —
handled it, got through it, struggled.

That turns the readiness map from a generic list into your own interview
record: which questions keep coming up, which ones you have struggled with, and
which themes real interviewers have raised that you still have no story for.
Struggles are ranked first in the next rehearsal, because an interviewer finding
the hole in an answer is better evidence than any verdict you gave yourself at a
desk. Counts stay counts: below four debriefs it says so rather than calling it
a pattern.

### Readiness

The other half of the same question. The map counts, rather than scores: a theme
is answerable when a *finished* story carries it, and a theme resting on exactly
one story is called out, because interviewers routinely ask two questions on the
same theme and the second one is where people repeat themselves. Questions with
no finished story behind them are listed in full, each one a link to writing the
story that is missing.

### Deciding on an offer

The end of a search is the one decision that is hard to reverse, and it is
usually made in a week, under a deadline someone else set, on the day the money
arrives. **Decide** puts that in front of you.

There is deliberately no score and no recommendation. Weighting a three-point
rating and printing 7.4 would be exactly the false precision this app refuses
everywhere else, and it would let you outsource the one call that is genuinely
yours. What it does instead:

- **The money in context** — first year, a steady year after that, and the whole
  vesting period, placed against the minimum on your profile and the range
  recorded for the role. Below your minimum, it says so and calls it a
  negotiation before it is a decision. Mixed currencies are refused, not
  converted.
- **What matters to you**, decided in Settings before an offer exists rather
  than under a deadline, weighted *nice to have / matters / decisive*. Each role
  is rated a concern, fine or a strength against them.
- **The read** — never a verdict. It names concerns you have recorded against
  something you called decisive, and counts what still has not been judged,
  because those are the questions worth asking before the deadline.
- **Against the other offer**, when a second is live: only the criteria you
  rated differently, heaviest first, in a labelled two-column table. Everything
  you scored the same is set aside, because that short list *is* the decision.
- **Accepting or declining, from the same sheet.** Reaching a conclusion and then
  having to go elsewhere to record it is how offers end up sitting open in a
  pipeline for months. Both confirm, both are undoable, and neither sends
  anything to anyone — telling them is still your job.

### Weekly review

Seven days in one pass: what moved, what is on the table, what has gone quiet. The first half is a
summary; the second half is the point — every stalled role is put in front of you with the decision
still open, and each one can be given a next step or let go from the review itself. It recommends
nothing.

Stage changes are collapsed to the net move per opportunity, so a record nudged back and forth
during the week is one line ("· 6 changes"), and one that ended the week where it started is none.

### Restore points and integrity

Undo covers a mistake you notice immediately. A restore point covers the rest: the workspace is
snapshotted automatically before anything sweeping — a restore, a bulk change, a wipe — and on a
twelve-hour cadence, keeping the six most recent of each kind. Snapshots live beside the data in
IndexedDB, so they are protection against *you*, not against losing the device; that is what the
JSON export is for, and the app says so rather than implying otherwise.

Settings → Safety also runs a consistency check: interviews pointing at deleted opportunities,
contact links that no longer resolve, an application date with no application stage, probable
duplicates. Each finding states what is wrong, how bad it is, and what the repair would do — and a
restore point is taken before any repair runs.

### Capture from anywhere

A posting is worth capturing in the ten seconds you are looking at it. Three routes, none of which
touch a server: a bookmarklet that sends the current tab's title and URL, the PWA share target on
Android, and a plain `#/capture?...` link you can wire into anything. All three open the normal add
dialog with the fields already filled and every value editable, and the company is read from the
page title in preference to a job board's URL slug, because "Meridian Systems" beats
"meridiansystems".

### Offer maths

An offer is rarely one number. The offer panel separates the first year (which includes the signing
payment) from a steady year (which does not) and from the total across the vesting period, and
lists what it could *not* account for instead of quietly treating a missing bonus as zero. Offers in
different currencies are shown side by side with a note, never summed.

### Analytics

Only metrics that could change what you do next. Every rate carries its
denominator, and anything below eight observations is rendered as directional
rather than as a conclusion.

**Which round loses it** is the one a tracker never answers: of the interviews
you have actually sat, which kind you get past and which kind ends it. Only
decided interviews count — a round still waiting on a result is not evidence
either way — and a round is named as a weakness only once it has ended things
more than once. When one is, the callout offers to rehearse that format, which
lands on the questions your debriefs recorded as struggles.

**Did preparation show?** compares advance rates for interviews whose stories
had been rehearsed *before the date* against those that had not. It appears only
when both sides exist, because a panel whose only possible message is "too few
to say" is not worth half a page — and even at scale it is a correlation on a
handful of interviews, which the copy says outright. Every rate carries its denominator, and anything
below eight observations is rendered as directional rather than as a conclusion.

---

## Keyboard

| Key | Action |
| --- | --- |
| `⌘K` / `Ctrl K` | Search and commands |
| `N` | Add an opportunity |
| `/` | Focus the search field |
| `⌘Z` / `Ctrl Z` | Undo the last reversible change |
| `Space` | Rehearsal: start or stop the clock |
| `P` / `S` | Rehearsal: peek at your notes / skip the question |
| `G` then `T` `O` `P` `C` `I` `S` `A` | Jump to a section |
| `↑` `↓` | Move between table rows |
| `↵` | Open the focused row |
| `X` / `Space` | Select the focused row |
| `⌘A` | Select everything in view |
| `S` / `P` | Change the focused row's stage / priority |
| `E` | Archive the focused row |
| `D` | Set a next action on the focused row |
| `Esc` | Close a panel, or clear a selection |
| `?` | Shortcut reference |

The pipeline board can be reordered by dragging or, equivalently, from each card's stage menu — so
it is fully usable from the keyboard.

Search is subsequence matching, so `hlcn` finds Halcyon Pay and `wkrv` finds the weekly review, and
every result shows which characters matched rather than leaving you to guess why it came back.

Undo is not tied to the toast. A toast is gone in nine seconds and the regret usually arrives
later, so every reversible action also joins a twenty-five deep stack that `⌘Z` walks back — an
archive, a bulk stage change, a deleted view. It is deliberately not persisted across a reload:
those closures would be meaningless, and a restore point is the right tool at that distance.

---

## Performance

- Route and dialog code is split into chunks that load on demand and are prefetched on idle. A cold
  load is about 233 kB gzipped in total (app, React and CSS); the chart library is 116 kB of that
  and is fetched only when Analytics is opened, and the question bank is its own chunk behind the
  Story Bank.
- `manualChunks` names only what the first paint needs. Naming a lazy library there is a trap: it
  drags the library's whole dependency subtree into that chunk, and one shared helper — `clsx`, in
  the case of Recharts — is enough to make the entry a static importer and undo the split.
- Table rows are a fixed height and marked `content-visibility: auto`, so the browser skips layout
  and paint for rows scrolled out of view. The print stylesheet turns that off again.
- Fit scoring is memoised, and the whole UI shares one score map per render pass.

---

## Testing

`npm test` bundles the suite with esbuild and runs it on Node's built-in test runner — no test
framework dependency. 215 tests cover the parser, the fit engine's honesty guarantees, the agenda
rules, duplicate detection, template rendering, iCalendar output, CSV reading and writing for both
record types, backup validation, the analytics sample-size handling, capture parsing, offer maths,
the weekly review's windowing and net-move collapsing, the fuzzy matcher, and the
question bank's coverage, drill ordering and sharpness rules, and the debrief's
counting, theme gaps and timing, and the interview record's
handling of undecided, cancelled and future
interviews, the outcome-chasing thresholds, the median that decides your usual answer length, and
the offer decision — what counts as a concern, when money can honestly be compared, and reducing two
offers to what actually separates them, and the starter
sets — every question resolvable by the rest of the app, none duplicating each other or the bank. Four tests guard the bundle rather than behaviour: no
eagerly-loaded module may statically reach the question bank, a mistake that costs every cold load a
few kilobytes and that nothing else in the build catches. It has been made three times, so the
guard resolves the real import graph — dynamic imports excluded, since those are the lazy boundary —
and is itself checked against a deliberate violation.

Browser behaviour was verified by hand: capture with duplicate detection, edit, archive, delete and
undo; persistence across reloads; filtering, sorting, saved views, pinning, bulk actions and
compare; drag-and-drop; row-level keyboard actions; contact, interview, story and template CRUD;
the composer, prep sheet and calendar export; JSON and CSV round-trips including malformed input;
the command palette; the weekly review; rehearsal end to end, including the recorded
verdict and its undo; the readiness map; restore points, the integrity check and its repairs;
capture by deep link; the debrief end to end, including its effect on the readiness map and on
rehearsal ordering; `⌘Z` across separate actions; both themes; desktop, tablet and mobile; and a
contrast audit of the colour tokens in both themes. Full tours were run with an injected counter on
`window.onerror`, `unhandledrejection` and `console.error`, and finished at zero.

Two limits belong to the environment rather than the app, and both degrade with a visible message:
service workers are blocked in some embedded browsers, which disables offline caching and install,
and a blocked clipboard makes copy report its failure instead of pretending to have worked.

---

## Browser support

Any current browser with IndexedDB. If storage is blocked — a private window, or strict privacy
settings — the app says so plainly instead of silently losing work. Where the clipboard is
unavailable, copying reports the failure rather than pretending to have worked.
