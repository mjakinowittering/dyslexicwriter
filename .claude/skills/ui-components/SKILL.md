---
name: ui-components
description: shadcn-svelte component library usage — components are copied into `src/lib/components/ui/` (add via CLI), the full component catalogue, doc URL pattern for exact props, and the optional MCP server. Load when building any UI, choosing a component, or needing exact prop names / variants. Never hand-roll buttons, inputs, or form elements.
---

# shadcn-svelte

shadcn-svelte is the component library for this project. Components are copied into the project (not installed as a package dependency) — do not hand-roll buttons, inputs, or form elements; always use shadcn-svelte components.

Add components via the CLI: `npx shadcn-svelte@latest add <name> --yes` (writes into `src/lib/components/ui/`).

### Documentation

Full component index (llms.txt): `https://www.shadcn-svelte.com/llms.txt`

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
2. **Behaviour / config props next** — flags and options: `canEdit = false`,
   `align`, `editRedirect`. Optional props stay grouped by meaning; do **not**
   push every defaulted prop to the end (`ContentSection` keeps `canEdit`
   mid-list).
3. **`class: className` always dead last** — the styling escape hatch.

```svelte
let {
    label,               // identity
    editHref,
    canEdit = false,     // behaviour
    icon: Icon,          // renames keep the `original: Alias` form, in place
    class: className     // escape hatch — always last
}: {
    label: string;
    editHref: string;
    canEdit?: boolean;
    icon: Component;
    class?: string;      // type annotation order matches the destructure
} = $props();
```

The semantic ordering is a **judgment call** and isn't linted. The one
mechanical part — **`class` last** — is enforced by a `no-restricted-syntax`
rule in `eslint.config.js` (report-only, on both the destructure and the type
literal), so a misplaced `class` fails lint. Reference examples:
`EmptyState.svelte`, `ContentEmpty.svelte`, `ContentSection.svelte`.

### Component catalogue

Form & Input: Button, Button Group, Calendar, Checkbox, Combobox, Date Picker, Field, Input, Input Group, Input OTP, Label, Native Select, Radio Group, Select, Slider, Switch, Textarea

Layout & Navigation: Accordion, Breadcrumb, Navigation Menu, Resizable, Scroll Area, Separator, Sidebar, Tabs

Overlays & Dialogs: Alert Dialog, Command, Context Menu, Dialog, Drawer, Dropdown Menu, Hover Card, Menubar, Popover, Sheet, Tooltip

Feedback & Status: Alert, Badge, Empty, Progress, Skeleton, Sonner, Spinner

Display & Media: Aspect Ratio, Avatar, Card, Carousel, Chart, Data Table, Item, Kbd, Table, Typography

Misc: Collapsible, Pagination, Range Calendar, Toggle, Toggle Group

### MCP Server (optional)

A multi-framework MCP server is available via `@jpisnice/shadcn-ui-mcp-server`. Install it for direct component source code and demo access:

```bash
claude mcp add shadcn -- bunx -y @jpisnice/shadcn-ui-mcp-server --framework svelte --github-api-key YOUR_TOKEN
```

When installed, use these tools:

- `list_components` — browse all available components
- `get_component` — retrieve source code for a specific component
- `get_component_demo` — access usage examples and documentation
- `get_component_metadata` — get dependencies and metadata
