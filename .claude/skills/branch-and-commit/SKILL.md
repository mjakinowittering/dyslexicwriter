---
name: branch-and-commit
description: How work is branched and committed in this repo — the branch is cut off `develop` as the first step of implementing an approved plan, and the commit is a short imperative subject plus a bulleted body. Load before starting implementation of any approved plan, before creating a branch, and before writing a commit message or staging a change.
---

# Branch and commit

Two rules, at the two ends of a piece of work:

1. **A branch is cut before the first edit**, off `develop`, named for the work.
2. **A commit is a short imperative subject plus a bulleted body** saying what
   changed and why.

Neither is a formality. The branch is what keeps `develop` clean while work is in
flight; the body is what a reader gets months later when the diff alone doesn't
explain the reasoning.

They sit at opposite ends of a task, so a skill that runs a whole piece of work —
`todo-review`, say — loads this one **twice**: once the moment a plan is
approved, to cut the branch, and again once the change is finished and green, to
stage and commit. Reload rather than working from memory of the first load.

---

## Branching

### When

The branch is created as the **first step of implementation** — immediately after
a plan is approved, before any file is touched. Not at commit time, and not
somewhere in the middle.

Plan mode changes nothing on disk, branches included, so a plan that opens a
branch must say so and then actually do it once approved. Name the branch **while
planning**, write it into the plan so it is approved along with the work, and cut
it the moment the plan is.

**No plan, no branch.** A branch exists to carry an implementation. An edit that
isn't one — adding or pruning a `README.md` Todo item, fixing a typo in a doc,
anything the user asked for directly that touches no app code — stays on the
current branch and is left uncommitted for the user. Cutting a branch for it
leaves a stub nobody merges.

### Naming

`<prefix>/<kebab-cased description>`

- **Prefix** — `bug/` for fixing something already built that misbehaves,
  `feature/` for work not yet built (including chores and decisions). Where the
  work comes from a `README.md` Todo item, its **subsection decides** — `### Bugs`
  or `### Features` — not the phrasing. A mixed selection takes `feature/`
- **Description** — kebab-case, **5–8 words and no more**. Drop articles and
  conjunctions; keep the subsystem and the change
- Lower case throughout. **No item numbers** (the Todo list renumbers on every
  read) and no ticket refs
- **One branch per plan**, however many items it covers — name what they share

```
bug/image-src-blob-url-resolution
bug/table-cell-borders-header-tint
feature/read-aloud-karaoke-auto-scroll
feature/welcome-folder-cards
```

### Cutting it

**Off `develop`** — never `master`, and never whatever happens to be checked out:

```
git switch develop && git switch -c <name>
```

- **Check `git status` first.** An unrelated dirty tree is the user's call: say
  what is uncommitted and ask, rather than carrying it onto the new branch
- **Already on a branch for this work?** Stay on it. Don't stack a second one
- If the work turns out to need a branch and none was cut — it was a small ask
  that grew, or the plan step was missed — cut it before committing rather than
  landing on `develop`. "Work" means changes to the app; a Todo-list or docs edit
  never grows into one

---

## Committing

### When

Last of all: the change is done, anything the plan promised to tidy is tidied,
and `npm run check`, `npm test` and `npm run lint` pass. A commit that needs a
follow-up "fix lint" is a commit made too early.

### Staging

`git add -A` from the repo root, then `git status --short` so the user sees
exactly what is staged before anything is written.

### Whether to commit

**Stage, then hand the message over** — the user makes the commit unless they ask
otherwise. When they do ask, run it, and end the message with the usual
`Co-Authored-By` trailer.

### The message

A **short imperative subject**, a blank line, then a **bulleted body**.

```
Replace welcome button with folder cards

- First run offers two cards: create Documents/DyslexicWriter, or
  pick any folder
- Adds a needs-permission state so a lapsed grant no longer reads as
  a first run
- The Reopen card supplies the user gesture requestPermission needs
- Probes the folder before adopting: permission can be granted for a
  folder that has since moved
```

**Subject**

- Imperative mood, sentence case, no trailing full stop, **under 72 characters**
- Say what changed and where — `Style editor tables with cell borders`, not
  `Fix styling`
- One commit per plan; several items share a subject naming what they share
- A partly-finished item commits what actually landed — the subject describes the
  work done, never the item's title

**Body**

- **Bullets, not prose paragraphs.** One bullet per change worth knowing about
- Wrap at **72 characters**, continuation lines indented two spaces
- Lead with what changed; add the _why_ where the diff can't show it — a
  constraint, a browser behaviour, a rejected alternative. A bullet reading
  `Probes the folder before adopting` earns its place because the reason
  follows it; `Updated the store` does not
- **Three to six bullets** for a normal change. If it needs more, the commit is
  probably two commits
- Skip the body only when the subject genuinely is the whole story — a typo fix,
  a version bump
- No trailing full stops on bullets; no nested sub-bullets
- Where the work came from a Todo item, a closing line naming it is welcome:
  `Closes the "Improve the welcome / first-run experience" todo.`

---

## What this skill does not decide

- **Pushing and PRs.** Neither happens unless the user asks. When they do, PRs go
  against `develop`
- **Rebasing, squashing, amending.** Not done on the user's behalf; ask
- **Anything that rewrites published history.** Never without an explicit
  instruction
