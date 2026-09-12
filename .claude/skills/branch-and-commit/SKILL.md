---
name: branch-and-commit
description: How work is branched, committed, pushed and turned into a PR in this repo — the branch is cut off `develop` as the first step of implementing an approved plan, the commit is a short imperative subject plus a bulleted body, and a newly published branch always prompts an offer to open a PR into `develop` (never `master`). Load before starting implementation of any approved plan, before creating a branch, before writing a commit message or staging a change, and before pushing a branch or running `gh pr create`.
---

# Branch and commit

Three rules, along the length of a piece of work:

1. **A branch is cut before the first edit**, off `develop`, named for the work.
2. **A commit is a short imperative subject plus a bulleted body** saying what
   changed and why.
3. **A branch that has just been pushed prompts an offer of a PR into `develop`** —
   and that PR is opened with an explicit `--base develop`, never the repo default.

None of them is a formality. The branch is what keeps `develop` clean while work
is in flight; the body is what a reader gets months later when the diff alone
doesn't explain the reasoning; and the base is the one detail nobody notices until
the PR is already sitting against `master`.

They sit at different points in a task, so a skill that runs a whole piece of work
— `todo-review`, say — loads this one **more than once**: the moment a plan is
approved, to cut the branch; again once the change is finished and green, to stage
and commit; and again if the user asks for a push, to offer the PR. Reload rather
than working from memory of an earlier load.

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

## Publishing and the PR

### Pushing

A push happens only when the user asks for one. When it does, publish the branch
with its upstream set:

```
git push -u origin <name>
```

### Offer the PR, every time

**A branch that has just been published is a branch with no PR yet.** The moment
the push succeeds — whether it was asked for on its own, or as part of "commit
and push" — **ask whether to open a PR from it into `develop`**. Ask once, plainly,
naming both ends:

> Pushed `feature/read-aloud-highlight-list-markers`. Open a PR into `develop`?

Then stop and wait. A PR is outward-facing and gets reviewers' attention, so it is
never opened on a guess. A "no" ends it — don't re-offer on the next push in the
same session unless the user brings it up.

### `--base develop`, always

This repo's default branch on GitHub is `master` (`origin/HEAD` points at it), so
**`gh pr create` bases the PR on `master` unless told otherwise**. That is the
mistake this step exists to stop. Pass the base explicitly, every single time:

```
gh pr create --base develop --head <name> --title "<subject>" --body "<body>"
```

- **Never omit `--base`.** Not "it'll pick the right one", not "the last PR went
  to develop" — the flag is the whole point
- `master` is a valid base only when the user says so in that message — a release
  or a hotfix going straight to production. Otherwise `develop`
- After it is created, **print the PR URL and the base branch back**, so a wrong
  base is visible immediately rather than at review time:
  `#45 → develop: https://github.com/…`
- Got it wrong anyway? `gh pr edit <n> --base develop` retargets an open PR in
  place; no need to close and reopen

### The PR body

The commit message is the source — it was written for exactly this. Reuse the
subject as the title and the bullets as the body; add a line of context above
them only where the PR spans more than the one commit. End the body with the
usual `🤖 Generated with [Claude Code]` attribution line.

---

## What this skill does not decide

- **Whether to push.** The user asks; this skill only makes sure that once a
  branch is published, the PR into `develop` is offered rather than forgotten
- **Merging.** Opening a PR is where this stops — never merge one on the user's
  behalf
- **Rebasing, squashing, amending.** Not done on the user's behalf; ask
- **Anything that rewrites published history.** Never without an explicit
  instruction
