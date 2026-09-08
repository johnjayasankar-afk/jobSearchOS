# Improvement log

One entry per improvement cycle. Newest first. Each entry records what shipped
and why, what was actually verified, what is still limited, and where the next
cycle should look.

---

## Cycle 10 — Reach, and closing the loops (v3.7.0)

### Why this

My log said "sweep the accumulated debt". Before following it I checked
something I had never actually tested in ten cycles: what all of this looks like
in a **brand-new, empty workspace**. Six cycles of features had only ever been
seen against rich demo data.

That check largely came back clean — Today, Analytics and the readiness map all
have real empty states, and the rehearsal room turns "no story yet" into a
prompt to write one rather than a wall. Worth knowing rather than assuming, and
it freed the cycle for the two items that actually mattered.

### What shipped

**Starter question sets for four other fields.** Cycle six made the bank
editable, which is not the same as usable: nobody writes twenty questions from
scratch, so anyone outside product still opened a list mostly not about them.
Settings → Questions now carries curated sets for **engineering, design, data
and marketing** — fourteen questions each, written to the same standard as the
built-ins, each with its own note on what the question is really after. They
load as *your own* questions, so every one can be edited or deleted, and they
count in coverage, drills and the debrief checklist immediately.

They are added rather than swapped in. Most built-ins about failure, conflict
and stakeholders apply to any field; the rest can be set aside individually,
which already worked.

**The decision closes its own loop.** The Decide sheet can now accept or decline:
the record moves to accepted or withdrawn, the offer's status follows, the stage
history gains an entry, and it is undoable. Reaching a conclusion and then having
to go elsewhere to record it is how offers sit open in a pipeline for months.

**Two small debts**, as planned: stranded decision ratings against criteria you
have since deleted are now found and cleared by the integrity check, and the
onboarding copy that still said "Fifteen fictional opportunities" reads the real
count from a tiny constants module — with a test that fails if the two drift.

### Critique pass

Adding fourteen questions took one click; removing them took fourteen. The
starter cards now carry **Remove** as well, which only deletes questions whose
text still matches the set — anything you edited afterwards is treated as yours
and left alone.

### Verified

- `tsc -b` clean; **215 tests pass** (was 210); `npm run build` clean;
  `npm audit --omit=dev` reports 0 vulnerabilities.
- New tests assert every starter question resolves against the app's real theme
  and format vocabularies, that no set duplicates another or the built-in bank,
  and that a set resolves into the bank like any custom question. The
  onboarding-count guard was checked **by deliberately breaking it** and watching
  it fail.
- In the browser: a genuinely emptied workspace toured across Today, the
  readiness map, the rehearsal room and Analytics; loading the engineering set
  and watching the readiness headline move to "0 of 49 questions"; adding and
  then removing the design set; accepting an offer and confirming the record
  moved to `accepted` with the offer marked accepted and history appended, then
  **⌘Z restoring all three** — which also confirmed the new action joins the
  global undo stack for free.
- Mobile at 375px with zero elements overflowing outside the intentionally
  scrollable regions; zero console errors across an eight-page tour.

### Limitations

- The starter sets are curated by hand and make no claim to be exhaustive or
  sourced — they are a starting point, and the UI says so.
- "Remove" matches on question text, so a set question you edited and then tried
  to remove as part of the set stays. That is the intended trade, but it means
  the card can keep offering Remove for questions it will not remove.
- The timing constants (`OUTCOME_AFTER_DAYS`, `DEBRIEF_WINDOW_DAYS`) are still
  fixed rather than sitting with the configurable thresholds in Settings. Judged
  not worth another setting this cycle.
- Accepting an offer does not archive the other live opportunities or prompt to
  decline them, which is what someone actually does next.

### Where the next cycle should look

1. **What happens after you accept.** The search does not end tidily: other
   offers need declining, live processes need withdrawing, contacts deserve a
   note. That is a real, bounded flow the app currently leaves entirely manual.
2. **A trend view for rehearsal**, once more than five runs are worth keeping.
3. **Make the timing thresholds configurable** alongside the existing ones.

---

## Cycle 9 — Deciding on an offer (v3.6.0)

### Why this

The end of the funnel was the least-developed stage relative to its stakes, and
it had been on the list for two cycles. The offer panel captured numbers and
`computeOfferValue` did the maths, but the Today action for a decision deadline
did one thing: link to a form. The single hardest-to-reverse decision in a job
search — usually made in a week, under someone else's deadline, on the day the
money arrives — got a link.

### What shipped

**A Decide sheet**, reached from the offer panel and from Today's deadline
action, with **no score and no recommendation**. Weighting a three-point rating
and printing 7.4 would be the false precision this product refuses everywhere
else, and worse, it would let you outsource the one call that is genuinely
yours. Instead:

- **Money in context.** First year, a steady year, the vesting period — placed
  against the minimum on your profile and the range recorded for the role. Below
  your minimum it says so and calls it "a negotiation before it is a decision".
  Mixed currencies are refused rather than converted, and anything not recorded
  is named rather than counted as zero.
- **What matters to you** — a standing list in Settings, weighted *nice to have
  / matters / decisive*, deliberately kept on the workspace rather than the
  offer, because what you want does not change between two of them and deciding
  it under a deadline is how people talk themselves into things. Each role is
  rated concern / fine / strength against it.
- **The read** — names concerns recorded against anything you called decisive
  ("that is the thing to resolve before saying yes") and counts what is still
  unjudged, because those are the questions worth asking before the deadline.
- **Against the other offer** — when a second is live, only the criteria you
  rated *differently*, heaviest first. Everything you scored the same is set
  aside, because that short list is the whole decision.

Eight starting criteria are seeded on first load so the sheet works out of the
box, and they are fully editable.

### Critique pass

The comparison first rendered as two chips separated by an arrow, with a
"Left: … Right: …" caption underneath — which meant decoding a legend to read
the most important table in the app. Replaced with a labelled two-column grid
carrying the company names in the header.

### Verified

- `tsc -b` clean; **210 tests pass** (was 197 — 13 new covering weight ordering,
  what counts as a concern, completeness ignoring nice-to-haves, the minimum and
  range comparisons, currency mismatch refusing to compare, and five on reducing
  two offers to their differences including the tied and one-sided cases);
  `npm run build` clean; `npm audit --omit=dev` reports 0 vulnerabilities.
- In the browser on demo data: the money block reading "Above the minimum you
  set by $82,000 — you said $180,000", the range comparison, and equity named as
  not counted; rating criteria and watching the read change to "You have a
  concern against the manager, which you called decisive"; the two-offer
  comparison verified by temporarily adding a second live offer, confirming it
  listed only the three differing criteria in weight order — then restoring the
  demo through the app's own reseed.
- Mobile at 375px; zero console errors across an eight-page tour; no horizontal
  document scroll (13 transient overflow rects traced to the sheet's entry
  animation and confirmed to be zero once settled).

### Limitations

- The comparison shows the *first* other live offer, not a chooser. With three
  simultaneous offers you would only see one of them.
- Criteria are global, so a rating recorded against a criterion you later delete
  is orphaned in `decisionRatings` rather than cleaned up. Harmless, but it
  accumulates.
- Nothing links the decision to the offer's status — deciding does not accept or
  decline anything; that is still done on the offer itself.
- Currency conversion is deliberately absent, so an offer in another currency
  can be recorded but not compared against your minimum.

### Where the next cycle should look

1. **Sweep the accumulated small debts** rather than adding surface: orphaned
   decision ratings, the fixed timing constants (`OUTCOME_AFTER_DAYS`,
   `DEBRIEF_WINDOW_DAYS`) that should sit with the configurable ones in Settings,
   and letting the decision close the loop by setting the offer's status.
2. **Starter question sets by discipline** — still the cheapest way to widen who
   the product serves.
3. **A trend view for rehearsal**, once more than five runs are worth keeping.

---

## Cycle 8 — Closing the outcome loop, and the clock's number (v3.5.0)

### Why this

Last cycle shipped "which round loses it" and ended by naming its own weakness:
the analysis needs outcomes recorded on past interviews, and **nothing ever
asked for one**. The only place to set an outcome was an edit dialog behind a
"Review" link. So the most valuable screen in the app could sit permanently
empty through no fault of the user — a feature that quietly depends on data it
never requests.

That was the obvious first job. The second, on the list since cycle 4: the
rehearsal clock measured how long you spoke and threw the number away.

### What shipped

**Three ways to record an outcome, each where the question naturally arises:**
- the **debrief** now asks *have you heard back* next to *how did it feel* —
  two genuinely different questions, so it asks both rather than conflating them;
- **Today** chases an interview ten days old with no result, explaining what the
  gap costs: "without one it is missing from what you get past and what ends it";
- a past interview awaiting a result carries a **Result** button on its row, and
  the row says "No result recorded" so the gap is visible before you act.

The prompt offers *Moved on*, *Rejected* and **Still waiting** — the last a real
answer, not a dismissal, because most of the time it is the truth. Answering it
stamps `outcomeAskedAt` and the question waits a week. A question you cannot
answer is just nagging.

**The clock's number is kept.** Each run stores its length with its verdict, the
last five per story. A story can now say how long you *usually* take — the
median, so one interrupted run does not move it — and the moment after you stop
shows this run against that. Running long is the most common way a good answer
stops landing, and it was the one thing in the room already being measured.

**Demo data** gained the most universal job-search experience it was missing: an
interview you sat, never heard back about, and did not chase. It also gives the
new prompt something real to point at on first run.

### Critique pass

The weakest part of the first pass was the Interviews page: it displayed
"Awaiting result" with no way to act on it, so the fix lived only in Today and
the debrief. The badge sits inside the row's title button and could not be made
interactive without nesting controls, so the row gained a compact **Result**
action and a "No result recorded" line instead.

### Verified

- `tsc -b` clean; **197 tests pass** (was 185 — 12 new across the chase
  thresholds, the week-long snooze, never chasing a decided interview, the median
  that decides your usual length, run-history capping, and a test asserting the
  point of the whole cycle: an interview is invisible to the round analysis until
  its outcome is recorded); `npm run build` clean; `npm audit --omit=dev` reports
  0 vulnerabilities.
- End to end in the browser: the Today prompt appearing for a 15-day-old
  interview; **Still waiting** persisting `outcomeAskedAt`, leaving the outcome
  `pending`, and removing the action from Today; the debrief's outcome question
  saving; and — the point of the exercise — Hiring Manager moving from **0/2 to
  1/3 advanced** in Analytics as a direct result of recording one outcome.
- Rehearsal: a timed run stored as `{at, seconds, rating}`, "You spoke for 0:07"
  in the verdict panel, and "Usually 0:07" on the story card.
- Mobile at 375px: the prompt's three cards stack with full-width tap targets;
  zero elements overflowing outside the intentionally-scrollable regions; zero
  console errors across an eight-page tour.

### Limitations

- `OUTCOME_AFTER_DAYS` (10) and `OUTCOME_SNOOZE_DAYS` (7) are constants, while
  comparable thresholds (`staleOpportunityDays`, `interviewFollowUpDays`) are
  user-configurable in Settings. Defensible defaults, but inconsistent.
- Length is stored for the last five runs only, so "usually" is a short window
  by design. It cannot show a trend over a whole search.
- Nothing stops you recording an outcome that contradicts the opportunity's
  stage — an interview marked advanced on a rejected opportunity is allowed, and
  only the integrity check would ever notice.

### Where the next cycle should look

1. **Offer decisions.** The end of the funnel is the least-developed stage
   relative to its stakes: the offer panel captures numbers and `computeOfferValue`
   does the maths, but nothing supports deciding — what you actually want from a
   role, weighed against what is on the table.
2. **Starter question sets by discipline**, now that the bank resolves — a
   content job that would widen who the product serves.
3. **Make the timing thresholds configurable** alongside the existing ones.
4. **A trend view for rehearsal**, once more than five runs are worth keeping.

---

## Cycle 7 — Which round loses it (v3.4.0)

### Why this

Three cycles had gone into the preparation loop, so this one started with a full
tour rather than the log. The product is strong nearly everywhere — but
Analytics analyses `opportunities` and had **never touched the interview
records**. The app knew the type and outcome of every interview you had sat and
never asked the question a candidate with a dozen interviews most wants
answered: *which round am I losing at?*

That is a synthesis gap rather than a missing feature. The data was already
there; nothing was reading it.

### What shipped

**`interviewRecord`** — per round type: held, advanced, rejected, undecided, and
an advance rate whose denominator is decided interviews only. A round still
awaiting a result is not evidence either way, and folding it in would make every
number look worse than it is. A round is named as the weakness only once it has
ended things at least twice.

**`preparedVsNot`** — advance rates for interviews whose pinned stories had been
rehearsed *before the interview date* against those that had not. Rehearsing
today must not retroactively improve last month's record, so the comparison is
time-aware.

**On the page:** a full-width "Which round loses it" section with a stacked bar
per round, and a callout naming the weakest with a **Practise this round**
button that opens rehearsal scoped to that format. On the demo data this reads
"100% of recruiter screens, 0% of hiring-manager rounds" — and practising lands
first on `strategy-not-do`, precisely the question both hiring-manager debriefs
recorded as a struggle. Analytics → the round → the question → the drill, all
from data the user entered.

**Demo data.** The old demo was an unrealistically smooth search: 15
opportunities, three interviews, not one interview ever lost. It now carries a
fourth closed opportunity and five more past interviews consistent with the
stage histories that already existed but had no records behind them — including
two hiring-manager rejections. More honest as a demonstration, and it lets the
new analysis show what it is for.

### Critique pass

"Did preparation show?" occupied half the section to say, for essentially every
real user, that it could not say anything. It now renders **only when both sides
have data**, and "Which round loses it" takes the full width otherwise — which
also fixed the cramped half-width bars. A panel whose only possible message is
"too few to compare" is not honest minimalism, it is dead space.

### Verified

- `tsc -b` clean; **185 tests pass** (was 174 — 11 new covering future,
  cancelled and undecided interviews, the weakest-round threshold, the thin-record
  guard, and the time-awareness of the preparation comparison); `npm run build`
  clean; `npm audit --omit=dev` reports 0 vulnerabilities.
- In the browser on a freshly seeded demo: the round breakdown reading 4/4, 0/2
  and 1/1; the weakest-round callout; **Practise this round** opening rehearsal
  titled "Hiring Manager questions" with the struggled question first; the
  preparation panel correctly absent at n=0 on one side; mobile at 375px; zero
  console errors across a seven-page tour.
- Investigated a 30-element overflow report on Analytics at 375px: it is the
  breakdown table inside its own `overflow-x-auto` container, which is the
  intended pattern, and the document itself does not scroll horizontally.

### Limitations

- Rounds are grouped by interview *type*, which the user assigns. Mislabelled
  interviews produce a mislabelled weakness, and nothing detects that.
- "Which round loses it" needs outcomes recorded on past interviews. Nothing
  prompts for an outcome the way the debrief prompt does, so a user who never
  sets one sees an empty analysis.
- `preparedVsNot` is a correlation over a handful of interviews and will
  essentially never reach `MIN_SAMPLE`. It is shown with counts and a plain
  caveat rather than a line of best fit.

### Where the next cycle should look

1. **Prompt for interview outcomes.** The debrief prompt proved this pattern
   works; the same treatment for a missing outcome would make the round analysis
   fill itself in, and it is the cheapest high-value thing left.
2. **Answer length.** The rehearsal clock still discards its duration — four
   cycles on the list now, still genuinely useful, still small.
3. **Rehearsal history**, so "fading" becomes a trend rather than a timestamp.
4. **Starter question sets by discipline**, now that the bank resolves.

---

## Cycle 6 — Your own questions (v3.3.0)

### Why this

My own log named this first, and re-reading the product confirmed it. The bank
built in cycle 4 is 35 questions written from product-management interviews.
For a designer, engineer, data scientist or marketer, a good part of it simply
does not apply — and the readiness map, the drills and the debrief checklist all
sit on top of it. That made the bank the single biggest limit on **who the
product serves**, and everything downstream inherited the lean.

The material was already there: cycle 5's debrief captures questions the bank
does not carry, and they were displayed but inert.

### What shipped

**The bank became something you resolve, not a constant.** `resolveBank(custom,
hidden)` returns the built-ins minus anything set aside, plus your own, and
every consumer — coverage, drills, debrief insights, the debrief checklist —
now takes that list as an argument. A question someone wrote counts exactly as
much as one that shipped, because nothing downstream can tell them apart.

**Settings → Questions.** Add, edit and delete your own questions with the same
fields a built-in has — theme, alternate themes, formats, and your own note on
what the question is really after. Built-ins are grouped by theme with a "set
aside" toggle, which is stored rather than deleted so the list survives an
update to the app.

**Add to bank, from the readiness map.** Each off-bank question a debrief
recorded gets a button that opens the editor pre-filled with what the
interviewer actually asked. That is the loop worth having: interview → debrief →
a question in your bank → coverage, drill, next debrief checklist.

**Storage:** DB v4 adds a `questions` table; the export envelope moves to schema
4 and carries them, with import validation and restore coverage.

### Fixed along the way

- **Hiding a question erased history.** Insights looked questions up in the bank
  in force, so setting one aside quietly shrank a debrief that had recorded it.
  Lookups now span the full built-in set: hiding says "this will not come up
  again", not "this never happened".
- **The question bank leaked into the entry chunk for the third time** (+4 kB gz),
  now via the workspace provider, which is eager. Resolution moved to a
  `useBank` hook that only lazy consumers call.
- Settings' header action wrapped below its paragraph; the 35 built-ins were an
  undifferentiated wall of rows. Both fixed in the critique pass — grouped by
  theme with per-theme counts of what is set aside.

### Verified

- `tsc -b` clean; **174 tests pass** (was 163); `npm run build` clean;
  `npm audit --omit=dev` reports 0 vulnerabilities; cold-load payload measured
  before and after the chunk fix: 236,819 → 233,149 bytes gzipped.
- The bundle guard was **extended and re-verified by deliberately breaking it**:
  it now walks the real static import graph (excluding dynamic imports, which are
  the lazy boundary) from four eager entry points, and includes a test that the
  resolver is not passing vacuously.
- In the browser: a custom question added and appearing in Settings; a built-in
  set aside and struck through with an undo toast; the readiness headline moving
  to "35 of 35" and the Leadership theme card to "4 questions draw on this"
  (4 built-in − 1 aside + 1 custom), which is the arithmetic proving the resolved
  bank reaches coverage; **Add to bank** pre-filling the editor with a question
  from a demo debrief; mobile at 375px with no horizontal document scroll (the
  settings tab strip scrolls on purpose, and nothing outside it overflows).

### Limitations

- Custom questions carry no marker in the readiness map or rehearsal. That is
  deliberate — they count the same — but it means you cannot tell at a glance
  which are yours without going to Settings.
- Setting a question aside is all-or-nothing; there is no way to say "only for
  recruiter screens".
- The demo workspace ships no custom questions, so the feature is discoverable
  only through Settings or an off-bank debrief entry.
- The built-in bank itself is still PM-flavoured. This cycle makes that
  correctable rather than correcting it; a second discipline's starter set would
  be a content job, not an engineering one.

### Where the next cycle should look

1. **Analytics has now gone four cycles untouched**, and there is real
   preparation data to report: what gets asked, what gets fumbled, how coverage
   has moved. It reports pipeline conversion and nothing about readiness.
2. **Answer length.** The rehearsal clock still discards its duration.
3. **Rehearsal history.** Only the last verdict is kept, so "fading" is a
   timestamp rather than a trend.
4. **Starter question sets by discipline** — now cheap, given the bank resolves.

---

## Cycle 5 — The debrief (v3.2.0)

### Why this

Last cycle's log named four candidates. Reassessed against the product, the
interview debrief was clearly the largest: a `debrief?: string` field already
existed but was a textarea buried in an edit dialog. Nothing prompted you to
fill it in while the memory was worth anything, nothing structured it, and
nothing connected it to the question bank built the cycle before.

That left the app's loop open. It could tell you what was coming and help you
practise, but an interview you had actually sat produced no learning at all.
Past interviews on the Interviews page were a dead end: an outcome badge and a
"Review" link.

### What shipped

**`src/lib/debrief.ts`** — counting over the debriefs you have written: which
bank questions have come up and in how many interviews, which you marked as a
struggle, which questions arrived that the bank does not carry, and which themes
real interviewers have raised that you still have no finished story for. Below
four debriefs it reports the counts as history rather than a pattern, matching
how the rest of the app treats small samples.

**The debrief sheet** — asks one thing above all, *what did they ask*, as a
checklist pre-filtered to that interview's format, with free text for anything
off-bank and a three-way verdict per question. The overall read and notes are
optional. Reopening edits rather than restarting; saving is undoable.

**A Today action** with the shortest shelf life in the app — it appears the day
of the interview, ranks above the follow-up (a follow-up can be written from
notes; notes cannot be written from memory a week later), and stops asking after
three days rather than nagging about a memory that has gone.

**The payoff, wired into what already existed:**
- the readiness map gained a "From your own interviews" section — real counts,
  the themes you were asked about with nothing written down, and the questions
  that came up outside the bank;
- questions you struggled with carry a **Practise** button and are ranked first
  in the next drill, because an interviewer finding the hole beats a verdict you
  gave yourself at a desk;
- the Interviews page shows debrief state on past rows and offers the action,
  including on the follow-up section, which is where the most recent interview
  actually sits;
- a command-palette entry that picks the most recent interview still in window.

**Demo data** now carries two structured debriefs so the feature is visible on
first run, and deliberately leaves the most recent interview undebriefed so the
Today prompt has something real to point at.

### Fixed along the way

- **The debrief prompt said "It happened today" for an interview two days ago.**
  `Math.max(0, -2) * -1` is 0, not 2 — a sign error of the same family as last
  cycle's "today"/"tomorrow" bug, now covered by a test that asserts the wording.
- **The most recent interview had no debrief action**, because rows in the
  "follow-up not recorded" section were not passed `past`. They are past
  interviews; they now say "Review" and offer the debrief.
- **Mobile: ticking a question squeezed its text to one word per line**, the same
  flex-shrink trap as last cycle's readiness cards. The question now has a width
  floor so the verdict picker wraps beneath it.
- `draftInterview` silently dropped the new fields, which would have discarded
  demo and imported debriefs.
- **The question bank leaked back into the entry chunk** (+5 kB gz on every cold
  load) because the agenda imported `debriefIsDue` from the module that carries
  it. The helper moved to the bank-free module, and a test now enforces it.

### Verified

- `tsc -b` clean; **163 tests pass** (was 141 — 19 new across counting,
  de-duplication within one interview, off-bank grouping, theme gaps, the
  timing window, drill re-ordering by real struggles, three agenda cases, and a
  bundle guard asserting the eager agenda cannot reach the question bank — the
  guard was checked by deliberately breaking it and watching it fail);
  `npm run build` clean; `npm audit --omit=dev` reports 0 vulnerabilities.
- In the browser: a debrief recorded end to end from the Interviews page and
  persisted to IndexedDB with verdicts and off-bank text intact, with its undo
  toast; the Today prompt appearing and clearing; the readiness map showing
  "asked in 2 of 2" and the sample-size caveat; the **Practise** button opening
  rehearsal with the struggled question first; a fresh demo load showing the
  whole loop; mobile at 375px with zero overflowing elements measured.

### Limitations

- Off-bank questions are recorded and displayed but cannot be rehearsed: a drill
  pairs a question to a story by theme, and free text has no theme. Letting the
  user tag their own questions is the obvious fix.
- Struggle counts drive drill ordering by *theme*, not by the specific question,
  so practising a rough question offers the whole theme rather than that one
  question first. Acceptable, but not exact.
- Nothing verifies a debrief is accurate; it is your own recall, and the app
  says so rather than implying otherwise.

### Where the next cycle should look

1. **User-authored questions.** Off-bank questions are already captured and are
   the most personal data in the app. Letting them be tagged with a theme would
   fold them into coverage, drills and the readiness map — and would fix the
   bank's PM lean for anyone in another discipline, which is the single biggest
   limit on who this product serves.
2. **Answer length.** The rehearsal clock still throws its duration away.
   Recording it would let a story say "you run to three minutes on this one",
   which is the most common interview failure and is already measured.
3. **Rehearsal history.** Only the last verdict is kept, so "fading" is a
   timestamp rather than a trend.
4. **Analytics has not been revisited in three cycles.** It reports pipeline
   conversion but nothing about preparation, now that there is real data about
   what gets asked and what gets fumbled.

---

## Cycle 4 — Rehearsal and readiness (v3.1.0)

### Why this, and not something else

The app was already strong at tracking: Today's priority engine, the
opportunity table, the pipeline, contacts, analytics and the weekly review are
all built out and honest. Reading the product end to end, the weakest link was
not the tracking — it was that **the Story Bank was write-only**. It could store
a STAR answer and suggest it for an interview, but it could not tell you:

- whether you could actually *deliver* that answer out loud, or
- which common questions you had **no** answer for.

That is the gap that decides interviews, and it sat inside the one feature built
for it. Everything in this cycle closes that gap.

### What shipped

**`src/lib/questions.ts`** — a fixed bank of 35 questions that recur in senior
interviews, spanning all 11 existing story themes. Each carries the themes that
answer it, the interview formats it appears in, and a hand-written note on what
the interviewer is testing. Matching to stories is tag overlap only — no
inference, no model — consistent with the product's rule against dressing
heuristics up as intelligence.

**`src/lib/rehearsal.ts`** — *sharpness* (`sharp` / `fading` / `needs work` /
`untested`), derived from your own last verdict plus recency, and per-interview
readiness. Deliberately split from the question bank so the agenda can ask "are
these stories practised?" without pulling 35 questions into the entry chunk.

**The rehearsal room** (`components/stories/Rehearsal.tsx`) — one question, a
clock, and your notes hidden, because recalling the answer is the exercise.
Stopping the clock reveals the notes beside a "check yourself" panel showing
what the question is probing for, so the verdict is a comparison rather than a
feeling. Verdicts are undoable and feed back into what the drill offers next.

**The readiness map** (`components/stories/Readiness.tsx`) — a second view on the
Story Bank. Counts, never scores: how many questions you could answer, which
themes rest on a single story, and the full list of questions with nothing
behind them, each linking to writing the missing story.

**Integration**, so it is part of the journey rather than a side pond:
- a Today action when an interview is near and its pinned stories are unpractised
  (it stays silent when no stories are pinned — choosing answers comes first);
- sharpness on story cards and in the interview prep sheet, with "Rehearse these";
- a command-palette entry, and `Space` / `P` / `S` documented in both shortcut lists.

### Fixed along the way

- **Agenda said "today" for an interview that was tomorrow.** The label keyed off
  elapsed hours, so a 2 p.m. interview 18 hours out was announced as today. Now
  it follows calendar days. This one could cost someone an evening of prep.
- **The rehearsal clock accumulated `setInterval` ticks**, which browsers throttle
  to nothing in a background tab. Rewritten to derive elapsed time from a start
  timestamp and recompute on `visibilitychange`.
- **Coverage was too generous.** One finished story per theme was reported as
  "ready"; it now takes two, because a second question on the same theme is where
  people repeat themselves. Single-story themes are named explicitly.
- **Horizontal overflow on mobile** — readiness cards ran 450px wide in a 375px
  viewport (grid items default to `min-width: auto`), clipping the state chip.
- **The question bank leaked into the entry chunk** via the agenda rule, adding
  ~5 kB gz to every cold load. Splitting `rehearsal.ts` out put it back behind
  the Story Bank route.

### Verified

- `tsc -b` clean; **141 tests pass** (was 118 — 23 new covering the bank's
  integrity, sharpness, depth-aware coverage, drill ordering, and the agenda rule
  in both its firing and non-firing cases); `npm run build` clean;
  `npm audit --omit=dev` reports 0 vulnerabilities.
- In the browser: readiness map and library view; the full rehearsal loop
  (start → peek → stop → rate) with the verdict persisted to IndexedDB
  (`rehearsalCount`, `lastRehearsedAt`, `lastRehearsalRating`) and its undo toast;
  sharpness surfacing on story cards after rating; the Today rehearsal action
  reading "2 of 2 pinned stories are untested…" with correct "Tomorrow" labelling;
  mobile at 375px with zero overflowing elements measured; light and dark themes.
- Timer correctness proved directly: with the interval fully throttled in a
  hidden document, the clock still read `0:06` after a 6-second wait once
  recomputed — the previous implementation showed `0:00`.
- Cold-load payload measured before and after the chunk split: 235,454 →
  231,771 bytes gzipped.

### Limitations

- `Space` could not be driven through the automation harness, which sends an
  empty `key` for it; the handler was verified with a correctly-formed
  `KeyboardEvent` instead. `P` and `S` were verified with real key presses.
- Live ticking of the clock could not be watched in this environment because the
  browser pane reports `document.hidden === true`, which suspends timers. The
  catch-up path was verified instead, which is the behaviour that was broken.
- Sharpness is self-reported by design. Nothing evaluates the content of an
  answer, and the product should not pretend otherwise.
- The demo workspace covers all 11 themes, so the readiness map shows no empty
  theme until you clear it or start fresh. Single-story themes still demonstrate
  the depth warning.

### Where the next cycle should look

1. **Rehearsal history.** Only the last verdict is kept. A short per-story log
   (date, rating, duration) would let the Story Bank show whether an answer is
   improving, and would make "fading" a trend rather than a timestamp.
2. **Answer length as data.** The clock already knows how long each run took but
   throws it away. Recording it would let a story say "you consistently run to
   3 minutes on this one", which is the single most common interview failure.
3. **Question bank coverage by role.** Questions are tagged by interview format
   but not by seniority or function; a designer or engineer using this gets a
   PM-leaning bank. Either broaden it or let the user add their own questions —
   the latter is probably the better product.
4. **Interviews page depth.** It is the thinnest page left (282 lines) relative
   to how high-stakes it is: no post-interview debrief capture while it is fresh,
   which is where the next story usually comes from.
