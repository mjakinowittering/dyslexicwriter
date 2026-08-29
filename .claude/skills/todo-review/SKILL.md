---
name: todo-review
description: Work through the `## Todo` list in README.md — split into Bugs and Features — picking one or more items to plan together, writing a new item into the right section, or pruning items that are already done or redundant. Load when the user runs `/todo-review`, or asks to review the todo list, pick up a todo, add to the todos, or clear out stale ones.
---

# Review todo

`README.md` holds the project's backlog in its final `## Todo` section, split into
`### Bugs` and `### Features` with related items grouped together inside each. This
skill is the front door to it: show the list, then **plan** one or more existing items,
**add** a new one, or **prune** the ones that no longer earn their place. It never
implements anything on its own — planning ends at an approved plan.

That structure is the skill's responsibility to maintain. Every mode below leaves the
two subsections intact and the grouping still true — a list that drifts back into one
undifferentiated pile stops being worth reading.

**Only planning branches.** A branch belongs to work that was planned and approved —
Step 3a, and there only, as its first step after approval. **Add** and **prune** edit
`README.md` on whatever branch is checked out and leave the change uncommitted for the
user: a one-file edit to the backlog is not work in flight, and a branch per todo item
leaves a trail of stubs behind.

## Step 1 — read the list

Read `README.md` and take the `## Todo` section only.

The section is split into two `###` subsections, **Bugs** first and **Features**
second, each holding its own `- [ ]` list. That split is part of the list's shape —
preserve it in every mode below.

- **Bugs** — something already built that doesn't behave as intended. A feature that
  exists but is broken, invisible, or shows the wrong thing is a bug, not a feature:
  the table item is filed here because tables insert fine and simply can't be seen
- **Features** — work not yet built, plus the decisions ("a decision to make, not a
  commitment") and project chores (deployment, enforcing a11y checks) that go with it.
  A chore with no user-visible defect behind it belongs here, not in Bugs

Within each subsection, **related items sit next to each other** — the two read-aloud
bugs are adjacent, as are the two read-aloud features. The order inside a subsection
carries no priority; it is grouping only.

Each **top-level `- [ ]` bullet is one item**. Items wrap across several lines
(continuations indented six spaces) and some carry nested sub-bullets indented four
spaces — all of that belongs to the parent item, not to a new one. Number the items
**`1..N` continuously in document order, straight through the subsection heading** —
Bugs take the low numbers, Features carry on from there. One number space, so `7` is
unambiguous without the user naming a section.

Ignore `- [x]` items unless the user asks about completed work.

## Step 2 — show the list, then ask the mode

Print the numbered list under its two headings, **one line per item** — a short summary
of each, not the full paragraph. The first clause of an item is usually its summary
already. Keep the numbering unbroken across the headings.

```
Bugs
 1. Fix the empty read-aloud voice picker — `loadVoices()` is never called
 2. Fix sentence splitting breaking on a `.` inside a word (`diagram.png`)
 3. Make inserted images actually display — resolve `src` to a `blob:` URL

Features
 4. Read-aloud: karaoke-style auto-scroll to follow the spoken sentence
 5. Reconsider the read-aloud speed control — presets instead of a slider
 ...
```

Then use **AskUserQuestion** with a single question, header `Mode`:

- **Plan item(s)** — pick one or more from the list, then design the change and present
  a single plan covering them
- **Add an item** — write a new item into the Todo list
- **Prune the list** — find items already done, obsolete, or duplicated, and remove the
  ones the user confirms

## Step 3a — Plan item(s)

**Choosing.** The list is longer than AskUserQuestion's four-option cap, so ask the user
to reply with the item's number rather than forcing a chunked picker. Say plainly that
**several numbers are allowed** — "reply with a number, or several (`3, 7`) to plan them
together".

If the skill was invoked with an argument, treat that as the choice and skip both this
and the mode question:

- **one number** (`/todo-review 5`) — that item
- **several numbers** (`/todo-review 3,7`, `/todo-review 3 7`, `/todo-review 2-4`) —
  all of them, deduplicated and planned in list order
- **a description** — match it against the list, and confirm the match before planning.
  A description may match more than one item; when it does, list the matches and confirm
  which are in scope rather than guessing

Numbers outside `1..N` are a typo, not an instruction — say which ones don't exist and
ask again rather than planning a subset silently.

**Sanity-check a multi-item selection before exploring.** Items chosen together are
usually related — the same file, the same feature, or one that unblocks another. If they
genuinely aren't, that is fine and the user may well have a reason, but say so once, up
front: note that the plan will read as separate workstreams, and offer to plan them
separately instead. Take the user's answer and move on; don't press it twice.

Adjacent numbers are a **hint** that items are related, since the list is grouped that
way — but only a hint, and only within a subsection. Two items either side of the
Bugs/Features boundary are neighbours by accident. A bug and a feature in the same area
are still perfectly reasonable to plan together (fixing the sentence split and adding
auto-scroll both live in read-aloud); the split is about what an item _is_, not about
what can be worked on at once.

**Before entering plan mode**, re-read every chosen item's full text, sub-bullets
included. These items are unusually specific: they name files, symbols and line numbers,
and they state what already exists versus what is missing. That framing is the brief.

With several items, also look for how they interact **before** designing anything:

- **Overlap** — two items touching the same file or symbol are one change, not two.
  Plan the shared edit once and say which items it satisfies
- **Ordering** — one item may make another cheaper, or make it moot. Sequence the plan
  by that dependency, not by the list's order
- **Conflict** — if two items pull in opposite directions, surface it before planning
  rather than quietly honouring one. Ask which wins

**Load the matching project skills** from the CLAUDE.md Skills Index before exploring —
`content-editor` for the editor and markdown round-trip, `content-tts` for read-aloud,
`filesystem-storage` for anything under `src/lib/fs/`, `client-stores` for the stores,
`animations` for motion, `ui-components` for shadcn, `i18n-messages` when new copy is
needed, `testing` before proposing tests.

**Rename the session.** It is called `Todo review` — a placeholder the client derives
from the `/todo-review` invocation, not a name anyone chose. The items are settled by
now, so the session is about _them_, and that placeholder is what `/resume` will show
for it forever.

Claude cannot do this part: `/rename` only works typed by the user, and a `/rename` line
in a reply is inert text. So propose the name and hand it over as one pasteable line —
the command alone, in a fenced block:

```
/rename Read-aloud sentence split + auto-scroll
```

Then **carry straight on** into plan mode. This is not an AskUserQuestion and it never
blocks the plan; if the user ignores the line, nothing is lost.

The name describes **the work** — the subsystem plus the change, in the shortest phrase
that identifies it.

- **No item numbers.** Step 1 renumbers the list on every run, and any add or prune
  shifts it, so `Todo 3` names nothing a week later
- **No `Todo` or `Todo review` prefix** — that is the placeholder being replaced
- **Around 40 characters**, sentence case, no trailing full stop — `/resume` truncates
- **One item** — name it: `Image src → blob: URL`
- **Several items** — name what they share (`Read-aloud sentence split + auto-scroll`),
  not both summaries joined. Where they genuinely share nothing — the case the
  sanity-check above already flagged — name the larger and append `+ 1 more`

If plan mode's verification drops a stale item and that makes the name wrong, emit one
corrected `/rename` line at that point rather than leaving a name for work that is no
longer in the plan.

**Name the branch.** The work never lands on `develop` directly. `branch-and-commit`
owns the naming, the prefix and the `git switch` lines; it is loaded twice over a run of
this skill — **once when the plan is approved, to cut the branch, and once when the
change is finished, to stage and commit it**. Neither load is optional and neither
covers for the other.

Naming happens here, while planning. Two things are this skill's to supply:

- The **prefix comes from the subsection** the item sits under — `bug/` for one under
  **Bugs**, `feature/` for one under **Features**. The heading decides it, not the
  phrasing; a mixed selection takes `feature/`
- **One branch per plan**, however many items it covers — name what they share, as the
  session name does

Name it here, state it in the plan so it is approved along with the work, and create it
as the plan's **first step** once approved — plan mode changes nothing on disk, branches
included.

**Call `EnterPlanMode`.** Then:

1. **Verify each item against the code.** Todos go stale — line numbers drift, files get
   renamed, part of the work sometimes lands early. Open every path the items cite and
   check the claims still hold. If one no longer does, say so up front; a plan built on a
   stale premise wastes the user's time. With several items, a stale one doesn't sink the
   rest — report it, drop it from the plan, and carry on with the others.
2. **Explore properly** — the surrounding patterns matter more than the diff. This
   codebase has strong conventions and a plan that fights them will be rejected.
3. **Ask clarifying questions as they arise**, with AskUserQuestion, at the point they
   block a decision — not batched at the end. Ask only about genuine forks the code
   can't settle: product/UX choices, scope boundaries, which of two viable approaches.
   Never ask what a `grep` would answer.

**The plan** is **one plan**, not several stapled together. With more than one item,
open with a line naming the items it covers, then organise the body by the work itself —
shared groundwork first, then the parts specific to each item, in the order they should
be done. Where two items collapse into one edit, say so rather than describing it twice.
Keep each item traceable: a reader should be able to see which steps satisfy which item.

It should cover, briefly:

- **a first step that opens the branch**: `git switch develop && git switch -c <name>`,
  with the branch name written out in the plan so it is approved along with the work
- what changes, in behaviour terms — what the user will see afterwards
- the files touched and roughly what happens in each
- the CLAUDE.md invariants that constrain it (the markdown round-trip's
  `toMarkdown`/`fromMarkdown` pairing, `config.json` as the only settings store,
  Paraglide for every string, native Svelte for motion, no `any`, no server) — call out
  any the item brushes against
- new Paraglide keys, if any, plus the recompile step
- what gets tested, and whether `npm run check` / `npm test` need to pass
- what is deliberately **out of scope** — several items already state their own limits
  ("sheet styling only, not pagination"; "column resizing is off by design"), and those
  limits carry into the plan. Each item's own fence still binds when it's planned
  alongside others; planning two items together widens the plan, never their scopes
- **a final step that closes the loop**: remove **every** completed item from the Todo
  list in `README.md` and re-run `npx prettier --write README.md`. Make this an explicit,
  numbered step in the plan naming the items by number, not an aside — every plan this
  skill produces ends with it. The `### Bugs` and `### Features` headings stay even if a
  subsection empties — an empty one is a fact worth seeing, and something will land
  under it soon enough

Then `ExitPlanMode` for approval.

**Once the plan is approved — load `branch-and-commit` (1 of 2) and cut the branch.**
This is the first thing that happens after approval, before a single file is edited.
Plan mode changed nothing on disk, so the branch named in the plan does not exist yet;
`git switch develop && git switch -c <name>`, under that skill's rules. Only then start
the work.

**Closing the loop.** When the approved plan is carried out, that last step is part of
the work, not an optional extra: once the change is done and verified, delete each
completed item's lines (its continuations and sub-bullets with it) and run prettier over
the README once, after the last removal. If only part of an item landed, don't delete it
— rewrite it down to the remainder, and say what's left; with several items, that's a
per-item judgement, so an item finished in full still goes even if a sibling only got
halfway. When an item is rewritten down, re-check it is still under the right heading
and still beside its relatives: fixing the broken half of a bug can leave a remainder
that is really a feature, and it should move rather than sit under **Bugs** describing
work that isn't one. Report the removals alongside the change so the list and the code
never disagree.

**Stage, and suggest the commit — load `branch-and-commit` (2 of 2).** Last of all, once
the change is verified, the README items are removed and `npm run check` / `npm test` /
`npm run lint` pass. That skill owns the staging, the subject line and the bulleted
body; load it again rather than working from memory of the first load.

The one thing this skill adds is the closing line naming the item the work came from —
`Closes the "Improve the welcome / first-run experience" todo.` — so the log and the
Todo list can be read against each other later. A partly-finished item commits what
actually landed, and names no item it did not finish.

## Step 3b — Add an item

Take the user's description (from the skill's argument if given, otherwise ask what the
item is). Then **investigate before writing it down** — an item worth adding is one
someone can pick up cold months later, and that takes real file paths and a real reading
of the current state.

Match the house style of the existing entries:

- open with an imperative — "Fix…", "Add…", "Scope…", "Migrate…"
- state **what already exists** and **what's actually missing**; several entries exist
  mainly to stop a future reader assuming the wrong thing ("No plugin is missing…";
  "insertion is already a proper TipTap image node…")
- cite files, symbols, and line numbers where they pin the problem down
  (`speech-controller.svelte.ts:98`), in backticks
- name the fix in a sentence when it's known, rather than leaving it open
- fence the scope explicitly if the item could be read as bigger than it is
- use nested sub-bullets (four-space indent) only when the item has genuinely separate
  parts, as the welcome-screen and GitHub Pages entries do
- keep the tone plain; this is a note to a future reader, not a ticket

**Then place it — the list is structured, so an item is never just appended.** Two
decisions, in order:

1. **Bugs or Features?** Use the test in Step 1: is this something already built
   misbehaving, or work not yet built? Decide it from what the investigation actually
   found, not from the user's phrasing — "add Mac shortcuts to the tooltips" sounds like
   a feature and is a bug, because the tooltips already exist and state the wrong keys on
   that platform. Where it is genuinely borderline, say which way you filed it and why in
   one line, so the user can move it
2. **Which neighbours?** Within that subsection, put it next to the items sharing its
   area — the same feature, the same files, the same subsystem. Name the item it now sits
   beside when you show it. Only when nothing in the subsection is related does it go at
   the end, and say so rather than leaving it looking arbitrary

Placing an item may show that an existing one is really its neighbour two groups away.
Moving that one too is fine and often right, but it is an edit the user didn't ask for —
propose it, don't fold it in silently.

**No branch, no commit.** Edit `README.md` where you stand. Don't load
`branch-and-commit`, don't `git switch -c`, don't stage or commit — being on `develop`
is fine here. This is the user's own backlog note and they commit it when it suits them.
The rule holds however substantial the item turns out to be: one citing a dozen files is
still a single edit to a single markdown file.

**Formatting.** Prettier owns `README.md` at `printWidth: 80`. Continuation lines sit at
six spaces, sub-bullets at four — a sub-bullet indented six will be swallowed into the
parent paragraph by the reflow, which is how the welcome-screen entry got mangled once.
Run `npx prettier --write README.md` after the insertion so `npm run lint` stays clean,
and re-read the section afterwards to check the reflow didn't do that.

Show the user the item as written, say which subsection it went into and what it sits
next to, and confirm it reads right.

## Step 3c — Prune the list

Items rot. Some get fixed in passing, some are overtaken by a later entry, some describe
code that no longer exists. Pruning clears those out so what's left is all live work.

**Scope.** By default, check the whole list. If the user names specific items — as an
argument (`/todo-review prune 3,7`, ranges and spaces accepted, same parsing as Step 3a)
or in their reply — check **those** and leave the rest alone. Numbers outside `1..N` are
a typo: say which don't exist and ask again. A named item is still only a _candidate_;
the user pointing at it is not evidence it's dead, so it earns removal the same way any
other does — on the code.

**Check every item against the code — never against memory.** An item is a candidate for
removal only on evidence:

- **Already done** — open the files and symbols it names and confirm the described state
  is the current state. A fix that looks plausible in the diff history isn't proof; the
  code is
- **Obsolete** — the file, component or approach it targets is gone, or a product
  decision has since ruled it out (the CLAUDE.md cuts: accounts, sync, collaboration,
  LLM features, extra toolbar controls)
- **Redundant** — another item already covers it, wholly or in part. Say which one. If
  they only overlap, the answer is usually to merge them into the fuller entry rather
  than delete either

Everything else stays. Age is not a reason, size is not a reason, and an item the author
explicitly parked ("deliberately not built… flagged as a future idea, not a commitment")
is doing its job by sitting there — leave it.

**Report before removing.** List each candidate with its number, the reason, and the
evidence — the file and line you checked. Then confirm with the user before touching the
README. Removing an item throws away the reasoning that went into writing it, so it's the
user's call **item by item** — never a bulk sweep on your own judgement, and never an
all-or-nothing choice that makes keeping one item cost them the others:

- **up to four candidates** — a single AskUserQuestion with `multiSelect: true`, one
  option per candidate, so the user ticks exactly the ones to drop
- **more than four** — the four-option cap bites, so ask them to reply with the numbers
  to drop, and say that a subset is expected ("all", "none", or e.g. `2, 5`)

Confirm the selection back before editing when it's anything other than what you
proposed. If nothing qualifies, say so plainly and change nothing.

Both subsections are in scope, and **Bugs** is where the rot collects fastest — a defect
often gets fixed in passing while a feature rarely gets built by accident. Check the
bugs against the code with that in mind, but hold them to the same evidence bar.

Redundancy is judged **within** a subsection, not across the boundary. A bug and a
feature can describe the same area without either being redundant: "make images display"
(a bug) and a hypothetical image-caption feature both touch the image node and neither
covers the other. Only merge two items when one genuinely subsumes the other's work.

**No branch, no commit** — as in Step 3b. Pruning edits `README.md` in place on the
current branch and stops there; the user commits.

Once confirmed, delete the confirmed items' lines in full (continuations and sub-bullets
with them) — leaving every unconfirmed candidate exactly as it was — then run
`npx prettier --write README.md` once and show what the list looks like after. Keep both
`###` headings even if a subsection is emptied, and don't re-sort the survivors: pruning
removes items, it doesn't regroup the ones that stay.
