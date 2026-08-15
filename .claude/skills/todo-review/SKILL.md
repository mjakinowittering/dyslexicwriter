---
name: todo-review
description: Work through the `## Todo` list in README.md — pick an item and plan it, write a new item, or prune items that are already done or redundant. Load when the user runs `/todo-review`, or asks to review the todo list, pick up a todo, add to the todos, or clear out stale ones.
---

# Review todo

`README.md` holds the project's backlog in its final `## Todo` section. This skill is
the front door to it: show the list, then **plan** an existing item, **add** a new one,
or **prune** the ones that no longer earn their place. It never implements anything on
its own — planning ends at an approved plan.

## Step 1 — read the list

Read `README.md` and take the `## Todo` section only.

Each **top-level `- [ ]` bullet is one item**. Items wrap across several lines
(continuations indented six spaces) and some carry nested sub-bullets indented four
spaces — all of that belongs to the parent item, not to a new one. Number the items
`1..N` in document order.

Ignore `- [x]` items unless the user asks about completed work.

## Step 2 — show the list, then ask the mode

Print the numbered list, **one line per item** — a short summary of each, not the full
paragraph. The first clause of an item is usually its summary already.

```
 1. Self-host the OpenDyslexic font under `static/fonts/` and wire it to the font pref
 2. Rename remaining `skeleton-app` references to `DyslexicWriter`
 3. Scope the OpenDyslexic choice to the editor surface only, not `html`
 ...
```

Then use **AskUserQuestion** with a single question, header `Mode`:

- **Plan an item** — pick one from the list, then design the change and present a plan
- **Add an item** — write a new item into the Todo list
- **Prune the list** — find items already done, obsolete, or duplicated, and remove them

## Step 3a — Plan an item

**Choosing.** The list is longer than AskUserQuestion's four-option cap, so ask the user
to reply with the item's number rather than forcing a chunked picker. If the skill was
invoked with a number as its argument (`/todo-review 5`), treat that as the choice and
skip both this and the mode question. A non-numeric argument is a description — match it
against the list, and confirm the match before planning.

**Before entering plan mode**, re-read the chosen item's full text, sub-bullets
included. These items are unusually specific: they name files, symbols and line numbers,
and they state what already exists versus what is missing. That framing is the brief.

**Load the matching project skills** from the CLAUDE.md Skills Index before exploring —
`content-editor` for the editor and markdown round-trip, `content-tts` for read-aloud,
`filesystem-storage` for anything under `src/lib/fs/`, `client-stores` for the stores,
`animations` for motion, `ui-components` for shadcn, `i18n-messages` when new copy is
needed, `testing` before proposing tests.

**Call `EnterPlanMode`.** Then:

1. **Verify the item against the code.** Todos go stale — line numbers drift, files get
   renamed, part of the work sometimes lands early. Open every path the item cites and
   check the claim still holds. If it no longer does, say so up front; a plan built on a
   stale premise wastes the user's time.
2. **Explore properly** — the surrounding patterns matter more than the diff. This
   codebase has strong conventions and a plan that fights them will be rejected.
3. **Ask clarifying questions as they arise**, with AskUserQuestion, at the point they
   block a decision — not batched at the end. Ask only about genuine forks the code
   can't settle: product/UX choices, scope boundaries, which of two viable approaches.
   Never ask what a `grep` would answer.

**The plan** should cover, briefly:

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
  limits carry into the plan
- **a final step that closes the loop**: remove the completed item from the Todo list in
  `README.md` and re-run `npx prettier --write README.md`. Make this an explicit,
  numbered step in the plan, not an aside — every plan this skill produces ends with it

Then `ExitPlanMode` for approval.

**Closing the loop.** When the approved plan is carried out, that last step is part of
the work, not an optional extra: once the change is done and verified, delete the item's
lines (its continuations and sub-bullets with it) and run prettier over the README. If
only part of an item landed, don't delete it — rewrite it down to the remainder, and say
what's left. Report the removal alongside the change so the list and the code never
disagree.

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
  parts, as the welcome-screen and Hugeicons entries do
- keep the tone plain; this is a note to a future reader, not a ticket

**Formatting.** Prettier owns `README.md` at `printWidth: 80`. Continuation lines sit at
six spaces, sub-bullets at four. Append the new item at the **end** of the Todo list, and
run `npx prettier --write README.md` afterwards so `npm run lint` stays clean.

Show the user the item as written and confirm it reads right.

## Step 3c — Prune the list

Items rot. Some get fixed in passing, some are overtaken by a later entry, some describe
code that no longer exists. Pruning clears those out so what's left is all live work.

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
README; use AskUserQuestion when there are few candidates, or ask for the numbers to drop
when there are many. Removing an item throws away the reasoning that went into writing
it, so it's the user's call, item by item — never a bulk sweep on your own judgement. If
nothing qualifies, say so plainly and change nothing.

Once confirmed, delete each item's lines in full (continuations and sub-bullets with
them), run `npx prettier --write README.md`, and show what the list looks like after.
