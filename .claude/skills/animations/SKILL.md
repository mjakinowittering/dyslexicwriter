---
name: animations
description: How motion/animation is done in this project — native Svelte only (svelte/transition, svelte/animate, svelte/motion, svelte/easing), shared timings from `src/lib/config/motion.ts`, and the two-phase sequential reveal pattern (slide width → fade content). Load when adding or changing any animation, slide/collapse panel, transition, or easing. Never hand-roll CSS transitions/keyframes or add a third-party animation library.
---

# Animations

All motion in this project uses **native Svelte** functionality only. Do **not** hand-roll
CSS `transition` / `@keyframes` / `cubic-bezier` for state-driven motion, and do **not** add
a third-party animation library.

Use the right Svelte primitive for the situation:

| Situation                                               | Primitive                      | Module              |
| ------------------------------------------------------- | ------------------------------ | ------------------- |
| Element **mounts / unmounts** (`{#if}`, `{#each}`)      | `in:` / `out:` / `transition:` | `svelte/transition` |
| A **persistent** value changes (element never unmounts) | `Tween` / `Spring`             | `svelte/motion`     |
| Keyed **list items reorder**                            | `animate:`                     | `svelte/animate`    |
| Easing curve for any of the above                       | `quintOut`, …                  | `svelte/easing`     |

Prefer `transition:` (bidirectional — reverses cleanly mid-flight). Use separate `in:` /
`out:` only when the two directions genuinely need different parameters (e.g. different
delays for a sequenced reveal, as below).

## Shared timings — never inline magic numbers

Duration and easing come from **`src/lib/config/motion.ts`**:

```ts
export const motionDuration = 700; // ms — one phase; two sequential phases = 1.4s
export const motionEasing = quintOut;
```

Import `motionDuration` / `motionEasing` everywhere so every surface moves on one curve and
can't drift. Do not introduce a second easing or a bare `cubic-bezier` string alongside a
Svelte easing — mixing a JS easing with a CSS curve is exactly the drift bug this replaced.

## The two-phase sequential reveal

For a slide-out panel/rail we want **container first, then content** on the way in, and the
**reverse** on the way out — with **no reflow** of the content while the width changes. Two
nested elements, each with its own transition and per-direction `delay`:

- **Outer** element = the width. `slide` with `axis: 'x'` animates width and clips with
  `overflow: hidden`, so the fixed-width inner content is never squashed/re-wrapped —
  `in` delay `0`, `out` delay `motionDuration`.
- **Inner** element = the content. `fade` — `in` delay `motionDuration` (appears after the
  width has opened), `out` delay `0` (fades before the width closes).

```svelte
{#if open}
    <div
        class="shrink-0"
        in:slide={{ axis: 'x', duration: motionDuration, easing: motionEasing }}
        out:slide={{
            axis: 'x',
            duration: motionDuration,
            delay: motionDuration,
            easing: motionEasing
        }}
    >
        <div
            class="w-64"
            in:fade={{
                duration: motionDuration,
                delay: motionDuration,
                easing: motionEasing
            }}
            out:fade={{ duration: motionDuration, easing: motionEasing }}
        >
            <!-- content at a fixed width so it never reflows mid-slide -->
        </div>
    </div>
{/if}
```

Reference implementations: `Navigation/Navigation.svelte` (the primary rail) and
`AiChat/AiChatPanel.svelte` (the chat panel).

**A revealing panel is hoverable before it is visible.** The outer element takes layout and
pointer events from `t=0`, but the inner content only starts fading in at `motionDuration`
— so hovering during phase one pops a tooltip for something that isn't on screen yet. If the
panel holds tooltips, hold them off for the full `2 × motionDuration` reveal in both
directions. There is no such mechanism in the app today, so it would have to be built
alongside the first panel that needs one.

## Route crossfades

To transition page content on navigation, wrap `{@render children()}` in `{#key …}`
with `in:`/`out:` fades. Two gotchas:

- **Key on the smallest thing that should transition.** Keying on `page.url.pathname`
  transitions _every_ navigation; to scope it to one boundary (e.g. entering/leaving
  `/content`) key on a boolean like `page.url.pathname === '/content'` — ordinary
  route-to-route moves keep the same key and don't animate.
- **Overlap the outgoing/incoming pages in one grid cell**, or they stack and jump the
  layout. Put them in a `grid grid-cols-1 grid-rows-1` container and give the keyed
  child `col-start-1 row-start-1`.

A route crossfade covers more distance/feel than an in-place panel slide, so it wants a
duration of its own — longer than `motionDuration` — rather than sharing a panel's
timing. There is no such constant in `motion.ts` today: this app has two routes and no
crossfade between them, so add one alongside `motionDuration` if a crossfade is ever
built.

**Fade the outgoing page out before fading the incoming in.** A simultaneous crossfade
reads as a muddy dissolve, and sliding a rail that occupies layout space reflows the main
area under a page that's already there. Delay the incoming fade by the rail's settle time
(`delay: motionDuration`) so the old page fades out first and the new one lands into a
settled layout. The outgoing `out:fade` runs immediately (no delay) and its tail overlaps
the incoming fade, so there's no blank gap. Reference: `routes/(app)/+layout.svelte`.

**Effects are paused inside the outgoing subtree.** As soon as an out-transition starts,
Svelte pauses the effects of the block leaving the DOM — it stays mounted and visible, but
it stops reacting. Anything you declare in there (`$effect`, `class:`, `style:`, a child
library's own presence/unmount logic) is dead for the rest of the transition. This bites
hardest with **portaled overlays** (tooltips, popovers, dropdowns): their content is a child
of `<body>`, so it neither fades with the page nor gets unmounted by the paused subtree, and
it sits at full opacity over the crossfade. The fix has to be driven from _outside_ the
transitioning block: a flag set on `<body>` by a component that isn't leaving, plus an
unlayered CSS rule that hides the portaled content while it is set — unlayered because
Tailwind's `display` utilities live in `@layer utilities` and would otherwise win.

## Persistent values — Tween

When the animated thing is a persistent element whose style changes (no mount/unmount), a
`transition:` can't apply. Use a `Tween` on a numeric progress and interpolate in the style.
`Editor/Page/Page.svelte` tweens the document width `0→1` and interpolates with
`calc()`; per-`set` options give the same asymmetric phase delay:

```ts
const expand = new Tween(expanded ? 1 : 0, {
    duration: motionDuration,
    easing: motionEasing
});
$effect(() => {
    void expand.set(expanded ? 1 : 0, { delay: expanded ? 0 : motionDuration });
});
const style = $derived(
    `max-width: calc(var(--doc-max-width) + (100% - var(--doc-max-width)) * ${expand.current});`
);
```

## Loading indicator — the `Loading` component

`$lib/components/Loading` is the **one** loading bar app-wide — a self-contained singleton
mounted once in the `(app)` shell, below the breadcrumbs (emerging from the breadcrumb's
`border-b`). No props, no per-page variant. Don't mount a bar per page; report loading into
the `loading` registry and this bar reflects it (see the `client-stores` skill).

It bundles every motion concern in one file: a `Tween` drives a continuous two-phase sweep
(grow → travel); a y-axis `slide` reveals/retracts it into the border seam; reduced-motion
falls back to a static bar; and it owns the visibility logic — `{#if visible}` off
`loading.active || navigating` with a leading show-delay + **trailing hide-grace**
anti-flicker. The trailing grace (hide only after loading is _continuously_ idle, not a
min-visible measured from first appearance) coalesces the back-to-back auto-select fetches
(license → products → content) into one bar instead of blinking between them. That debounce
is legitimately timer-driven (`$effect` + `setTimeout`), the one place state is assigned
inside an `$effect` here because `$derived` can't express "appear after 150ms, hide 400ms
after the last idle". To see it under real latency, use the dev slow-connection sim
(`offline-pwa` skill) rather than a hand-rolled `setTimeout`.

## Accessibility & reuse

- Honour reduced-motion for non-trivial movement — gate parameters on
  `prefersReducedMotion.current` (`svelte/motion`).
- Duplicated `use:`-style motion behaviour belongs in `$lib/actions/`, not copy-pasted.
- Run `svelte-autofixer` (Svelte MCP) on every animated component until it reports no issues.
