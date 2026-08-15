import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dirname =
    typeof __dirname !== 'undefined'
        ? __dirname
        : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
    plugins: [
        tailwindcss(),
        sveltekit(),
        paraglideVitePlugin({
            project: './project.inlang',
            outdir: './src/lib/paraglide'
        })
    ],
    test: {
        expect: {
            requireAssertions: true
        },
        projects: [
            {
                extends: './vite.config.ts',
                test: {
                    name: 'client',
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        instances: [
                            {
                                browser: 'chromium',
                                headless: true
                            }
                        ]
                    },
                    // Svelte component tests, plus the markdown converters —
                    // those go through @tiptap/html's browser build and need a
                    // real DOM, which is also exactly how they run in the app.
                    include: [
                        'src/**/*.svelte.{test,spec}.{js,ts}',
                        'src/lib/markdown/**/*.{test,spec}.{js,ts}'
                    ]
                }
            },
            {
                extends: './vite.config.ts',
                test: {
                    name: 'server',
                    environment: 'node',
                    include: ['src/**/*.{test,spec}.{js,ts}'],
                    exclude: [
                        'src/**/*.svelte.{test,spec}.{js,ts}',
                        'src/lib/markdown/**/*.{test,spec}.{js,ts}'
                    ]
                }
            },
            {
                extends: true,
                plugins: [
                    // The plugin will run tests for the stories defined in your Storybook config
                    // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
                    storybookTest({
                        configDir: path.join(dirname, '.storybook')
                    })
                ],
                test: {
                    name: 'storybook',
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright({}),
                        instances: [
                            {
                                browser: 'chromium'
                            }
                        ]
                    }
                }
            }
        ]
    }
});
