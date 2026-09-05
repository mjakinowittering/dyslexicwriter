---
name: ui-components
description: shadcn-svelte component library usage — components are copied into `src/lib/components/ui/` (add via CLI), the doc URL pattern for exact props, and this project's prop-ordering rule. Load when building any UI, choosing a component, or needing exact prop names / variants. Never hand-roll buttons, inputs, or form elements.
---

# shadcn-svelte

shadcn-svelte is the component library for this project. Components are copied into the project (not installed as a package dependency) — do not hand-roll buttons, inputs, or form elements; always use shadcn-svelte components.

Add components via the CLI: `npx shadcn-svelte@latest add <name> --yes` (writes into `src/lib/components/ui/`).

**Only what the app actually renders is checked in.** A component nobody imports
is deleted rather than kept "in case" — it is one command away, and an unused copy
still shows up in the tree, the bundle analysis and every grep. Equally: do not
hand-edit anything under `ui/`. The next `shadcn-svelte add` overwrites it. Change
the call site instead.

### Documentation

Full component index (llms.txt): `https://www.shadcn-svelte.com/llms.txt` — the
catalogue lives there rather than being copied here, where it would rot as
shadcn ships components.

Individual component docs follow this pattern — fetch when you need exact prop names, usage examples, or variant options:

```
https://shadcn-svelte.com/docs/components/{component-name}.md
```

Examples:

- `https://shadcn-svelte.com/docs/components/button.md`
- `https://shadcn-svelte.com/docs/components/input.md`
- `https://shadcn-svelte.com/docs/components/dialog.md`

### Prop ordering in `$props()`

Order the destructured props (and the type annotation, which mirrors it **1:1**)
by **semantic prominence**, not alphabetically and not required-before-optional:

1. **Content / identity props first** — what the component _is_: `icon`, `title`,
   `description`, `label`, `content`. Reading order, not A–Z.
2. **Behaviour / config props next** — flags and options: `disabled = false`,
   `align`, `renaming`. Optional props stay grouped by meaning; do **not** push
   every defaulted prop to the end (`FileTreeNameRow` keeps `initialValue`
   mid-list, beside the other naming props).
3. **`class: className` always dead last** — the styling escape hatch.

```svelte
let {
    entry,               // identity
    actions,
    renaming = false,    // behaviour
    icon: Icon,          // renames keep the `original: Alias` form, in place
    class: className     // escape hatch — always last
}: {
    entry: DocumentIndexEntry;
    actions: FileTreeActions;
    renaming?: boolean;
    icon: Component;
    class?: string;      // type annotation order matches the destructure
} = $props();
```

The semantic ordering is a **judgment call** and isn't linted. The one
mechanical part — **`class` last** — is an `error`-level `no-restricted-syntax`
rule in `eslint.config.js`, checked on both the destructure and the type literal,
so a misplaced `class` fails `npm run lint`. Reference examples:
`EmptyState.svelte`, `FileTreeDocument.svelte`, `ConfirmDialog.svelte`.
