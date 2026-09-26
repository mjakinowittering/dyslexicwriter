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

Every duration and easing comes from **`src/lib/config/motion.ts`**, which holds six
exports and no more:

```ts
export const motionDuration = 700; // one phase; two sequential phases = 1.4s
export const motionEasing = quintOut; // the one curve
export const disclosureDuration = 180; // a Files-screen folder opening
export const followScrollDuration = 450; // read-aloud following the voice
export const arrivalHoldDuration = 1000; // Show in Files: the row's highlight holds
export const arrivalFadeDuration = 1200; // ... then lets go
```

The durations differ because the movements do, and each says why in the file:
a disclosure row is small, frequent and local, and at `motionDuration` it reads as the
app thinking rather than responding; the read-aloud follow has to keep pace with
speech, which at 700ms would still be gliding when the next sentence starts; the
arrival highlight has nothing waiting on it, so it can take its time. Reach for the
one that matches the movement, and add another only with the same kind of argument
written beside it.

Import them everywhere so every surface moves on one curve and can't drift. Do not
introduce a second easing or a bare `cubic-bezier` string alongside a Svelte easing —
mixing a JS easing with a CSS curve is exactly the drift bug this replaced.

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

The reference implementation is **`Settings/SettingsPanel.svelte`** — the editor's
right-hand column, and the only two-phase reveal in the app. Note where the surface
sits: the `<aside>` that slides carries the background and border, and the inner
`<div>` that fades carries only the controls. Put the surface on the fading element
instead and phase one opens an empty gap, so the panel arrives with its contents
rather than before them.

`Page.svelte` gates its own width tween on the same `prefersReducedMotion` signal the
panel reads, so the document sheet and the panel stay in step.

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

## Indeterminate indicators — the one Tailwind exception

An **indeterminate, indefinitely looping** indicator — a spinner — is the single case none
of the primitives above cover. `transition:` fires on mount/unmount, `Tween`/`Spring` move
a value toward a target and then stop; neither expresses "turn until the work is done".
For that, and only that, use Tailwind's own `animate-spin` utility (Tailwind v4 core:
`--animate-spin: spin 1s linear infinite`).

This is not a licence to reach for CSS. It is not hand-rolled — no `@keyframes` and no
`cubic-bezier` of ours — and it is not a third-party library. Everything **state-driven**
still goes through native Svelte on `$lib/config/motion.ts` timings.

Reduced motion is still gated in JS, the same as everywhere else, so there is one idiom in
the codebase rather than a CSS `motion-reduce:` variant sitting alongside
`prefersReducedMotion.current`. Drop the rotation, keep the glyph, and make sure a text
label carries the meaning — a bare spinner says nothing to a screen reader and nothing at
all once it stops turning:

```svelte
let iconClass = $derived.by(() => {
    if (!saving) return 'size-3';
    return prefersReducedMotion.current ? 'size-3.5' : 'size-3.5 animate-spin';
});
```

The worked example is the statusbar's save chip
(`src/lib/components/Editor/Statusbar/StatusbarUnsaved.svelte`), which swaps a record dot
for `Loading02Icon` — a broken circle — while a write is in flight. There is no shared
`Loading` component and no app-wide loading bar; this app does no network I/O, and the only
wait worth showing is a save.

## Accessibility & reuse

- Honour reduced-motion for non-trivial movement — gate parameters on
  `prefersReducedMotion.current` (`svelte/motion`).
- Duplicated motion behaviour belongs in one module both callers import, the way
  `$lib/utils/scroll-animator.svelte.ts` serves the read-aloud follower and the
  back-to-top glide. There is no `$lib/actions/` directory; create one only when a
  second component genuinely needs the same `use:` action.
- Run `svelte-autofixer` (Svelte MCP) on every animated component until it reports no issues.
