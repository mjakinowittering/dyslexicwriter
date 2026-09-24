---
description: Building UI with shadcn-svelte (copied into `src/lib/components/ui/`, added via CLI, vega style), the docs URL for exact props, the `index.ts` barrel every app component has, the shared Icon / EmptyState / ConfirmDialog scaffolds, and `$props()` ordering. Load when building any UI, choosing a component, or needing exact prop names / variants.
name: ui-components
---

# UI components

shadcn-svelte components are copied into `src/lib/components/ui/` by the CLI
(`npx shadcn-svelte@latest add <name> --yes`) — never hand-roll buttons, inputs or form
elements.

**Leave `ui/` pristine.** The registry output is the file, and the next
`shadcn-svelte add` overwrites anything typed into it. ESLint ignores the directory and
coverage excludes it for the same reason: it is vendored, not ours. Changing how a
component looks is a call-site or a token change, never an edit under `ui/`.

The project is on the **`vega`** style with `baseColor: neutral` (`components.json`) —
re-add a component in that style, not the default, or it arrives with different
internals from its neighbours. Only what the app actually renders is checked in; a
component nobody imports is deleted rather than kept "in case".

**Docs:** the index is `https://www.shadcn-svelte.com/llms.txt`; each component is at
`https://shadcn-svelte.com/docs/components/{name}.md`. Fetch it when you need exact
props or variants rather than guessing.

## App components

`src/lib/components/<PascalCase>/` — one folder per component, each with an `index.ts`
barrel that renames the files to short members:

```ts
import Root from './Welcome.svelte';
import Card from './WelcomeCard.svelte';
import Hero from './WelcomeHero.svelte';
import Preview from './WelcomePreview.svelte';

export { Root, Hero, Card, Preview };
```

Call sites import the namespace — `import * as Welcome from '$lib/components/Welcome'`
— and render `<Welcome.Root />`, `<Welcome.Card />`. The file keeps the group prefix
(`WelcomeCard.svelte`) so it is findable; the barrel drops it so the markup reads
cleanly. Add the member to `index.ts` in the same commit as the file.

### The three shared scaffolds

- **`Icon/Icon.svelte` — every icon in the app draws through it.** Hugeicons renders
  from icon _data_, so the glyph arrives as a prop
  (`<Icon icon={FileAddIcon} />`). It defaults `aria-hidden="true"` in one place,
  because nearly every icon sits inside an already-labelled button, and it is keyed on
  the icon data — Hugeicons builds the `<svg>` imperatively on mount and never re-reads
  the prop, so a glyph that swaps with state needs the remount. Never import
  `HugeiconsIcon` directly.
- **`EmptyState/EmptyState.svelte`** wraps shadcn's `empty` for every "nothing here"
  screen — the unsupported browser, the missing folder, an empty working folder, a
  folder of files the app can't open. Optional `icon`, a `title`, a `description`, and
  an optional `action` snippet for a CTA.
- **`ConfirmDialog/ConfirmDialog.svelte`** is the only confirm in the app; there is no
  `window.confirm`. `destructive` is about **consequence, not emphasis** — a delete
  takes something off the writer's disk and earns the red, whereas letting a folder go
  touches nothing and does not.

### Other conventions in force

- **Tooltips come from `$lib/components/ui/tooltip`** like any other primitive. The
  editor's transport group owns a single `Tooltip.Provider` in `ToolbarTts.svelte`
  rather than one per button.
- **Stateful toolbar controls are rows in `Editor/Format/definitions.ts`**, not
  bespoke components — icon, label, hint, shortcut, the `value` the control reports
  itself under, and the command. See `content-editor`; that table is capped by product
  decision and is not an invitation to extend it.
- **A custom clickable element sets `cursor-pointer` itself** — the Files tree's rows
  and `PageBackToTop` do, because they are bare `<button>`s rather than shadcn
  `Button`s.
- **Never hardcode a colour.** Every token lives in `src/routes/layout.css`; see
  CLAUDE.md.

## `$props()` ordering

Destructure (and mirror 1:1 in the type) by **semantic prominence**, not A–Z and not
required-before-optional:

1. content / identity — `icon`, `title`, `label`, `description`, `entry`
2. behaviour / config — `destructive = false`, `disabled`, `align`; defaulted props
   stay grouped by meaning rather than being pushed to the end
3. `class: className` **always last** — the styling escape hatch

The semantic part is a judgment call. The mechanical part — `class` last — is an
`error`-level `no-restricted-syntax` rule in `eslint.config.js`, checked on both the
destructure and the type literal, so a misplaced `class` fails `npm run lint`. It is
report-only: moving it means moving its type sibling too, so a human makes the edit.

References: `EmptyState.svelte`, `ConfirmDialog.svelte`, `FileTreeDocument.svelte`.

## Stories

Every component gets a story under `src/stories/`, mirroring the component tree —
never co-located. Remember a story costs **two** test cases, not one: the Storybook
vitest project runs twice, once per theme, with the a11y addon enforcing. See
`testing`.
