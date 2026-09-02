import { setProjectAnnotations } from 'storybook/preview-api';
// The light theme. See `vitest.setup.dark.ts` for why this file exists and
// how the annotations are composed — the two are identical but for the theme.
// @ts-expect-error — virtual module, no types on disk
import { getProjectAnnotations } from 'virtual:/@storybook/builder-vite/project-annotations.js';

import './silence-known-warnings';

setProjectAnnotations([
    getProjectAnnotations(),
    { initialGlobals: { theme: 'light' } }
]);
