import { quintOut } from 'svelte/easing';

// One phase of the focus-mode slide. Two sequential phases (width, then fade) run
// back-to-back, so total motion = 2 × this. Shared by the nav rail, the AI Chat panel,
// and the editor document-width tween so all three move on one easing curve. See the
// `animations` skill.
export const motionDuration = 700; // ms
export const motionEasing = quintOut;

// Route crossfade (entering/leaving /content). Longer than a single slide phase so the
// page dissolve eases out a few beats behind the nav rail. See the `animations` skill.
export const crossfadeDuration = 1000; // ms
