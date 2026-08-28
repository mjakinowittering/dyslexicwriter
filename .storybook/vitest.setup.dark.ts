import { setProjectAnnotations } from 'storybook/preview-api';
// Resolved by builder-vite at run time — the same module `@storybook/addon-vitest`
// imports in its own setup file, so the addons' annotations (addon-a11y's axe run
// above all) come through exactly as they would automatically.
//
// Since Storybook 10.3 the plugin provisions those annotations itself and stands
// aside as soon as a setup file inside this directory calls
// `setProjectAnnotations` — which is the only lever for choosing the theme the run
// is scanned in. `initialGlobals` sets the `theme` global that
// `withThemeByClassName` reads; composing it after the real annotations means it
// overrides the theme and inherits everything else.
//
// See `vitest.setup.light.ts` — the pair of them is what gets both themes axe-
// checked instead of only the preview's default.
// @ts-expect-error — virtual module, no types on disk
import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';

setProjectAnnotations([
    getProjectAnnotations(),
    { initialGlobals: { theme: 'dark' } }
]);
