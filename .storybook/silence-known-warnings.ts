// Two known-benign browser messages, silenced at source for the Storybook test
// projects. Imported by both `vitest.setup.light.ts` and `vitest.setup.dark.ts`.
//
// Filtering happens here, in the browser, rather than in vite.config.ts because
// each message is picked up twice on the way out — once by Vitest's own console
// capture and again by Vite's `forwardConsole` — so a filter on either channel
// alone still leaves the other printing. Patching the console here catches both,
// and it works because Vite wraps `console[level]` when its client loads: a
// wrapper added afterwards sits outside Vite's and returns before it forwards.
// Vite's own switch (`server.forwardConsole.logLevels`) is per-level rather than
// per-message and would take every browser warning with it, `npm run dev`
// included.
//
// 1. `derived_inert` is bits-ui's, not ours. Its dismissable layer registers
//    document-level `pointerdown` listeners and reads boxed `.current` props —
//    Svelte deriveds — inside them, so a layer torn down while a listener is
//    still attached reads a derived whose parent effect is already destroyed.
//    Stack-traced to
//    `bits-ui/dist/bits/utilities/dismissible-layer/use-dismissable-layer.svelte.js`,
//    reproducibly, from the AppHeader menu stories in both themes.
//
// 2. "ResizeObserver loop completed with undelivered notifications" is the
//    browser telling itself a layout pass ran long. Nothing in `src/`
//    constructs a ResizeObserver; it comes from the floating-element libraries
//    under shadcn, and only when the browser projects run together.
//    `@vitest/browser` re-throws it, which is what puts it on the console.
//
// Matched on those exact strings and nothing else: every other warning and
// error — including any we do cause — still comes through, and Vitest's own
// `onUnhandledError` (vite.config.ts) still fails the run on a real one. If a
// dependency upgrade fixes either lifecycle, the matching stops and this goes.
const SILENCED = ['derived_inert', 'ResizeObserver loop completed'];

function silences(args: unknown[]): boolean {
    const first = args[0];
    const text =
        typeof first === 'string'
            ? first
            : first instanceof Error
              ? first.message
              : '';
    return SILENCED.some((s) => text.includes(s));
}

const warn = console.warn.bind(console);
const error = console.error.bind(console);

console.warn = (...args: unknown[]): void => {
    if (silences(args)) return;
    warn(...args);
};

console.error = (...args: unknown[]): void => {
    if (silences(args)) return;
    error(...args);
};
