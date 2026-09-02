// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import path from 'node:path';

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import storybook from 'eslint-plugin-storybook';
import svelte from 'eslint-plugin-svelte';
import tailwind from 'eslint-plugin-tailwindcss';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
    includeIgnoreFile(gitignorePath),
    // shadcn-svelte primitives are vendored as-is — don't lint generated code.
    { ignores: ['src/lib/components/ui/**'] },
    js.configs.recommended,
    ts.configs.recommended,
    svelte.configs.recommended,
    prettier,
    svelte.configs.prettier,
    ...storybook.configs['flat/recommended'],
    {
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
        rules: {
            // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
            // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
            'no-undef': 'off'
        }
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                extraFileExtensions: ['.svelte'],
                parser: ts.parser,
                svelteConfig
            }
        }
    },
    // Validate Tailwind class strings in Svelte markup. Uses the Svelte-aware
    // beta of the v4 plugin (Tailwind v4 is CSS-first — no tailwind.config.js),
    // so the config is read from the CSS entry via `cssConfigPath`.
    {
        files: ['**/*.svelte'],
        plugins: { tailwindcss: tailwind },
        settings: {
            tailwindcss: {
                cssConfigPath: './src/routes/layout.css'
            }
        },
        rules: {
            ...tailwind.configs.recommended.rules,
            // prettier-plugin-tailwindcss already sorts classes (different
            // algorithm) — leave ordering to it to avoid conflicting fixes.
            'tailwindcss/classnames-order': 'off',
            // Project classes rather than generated Tailwind. `reading-font`
            // is declared in layout.css and dresses the document surface in
            // OpenDyslexic; it is deliberately not a `font-*` utility name.
            // The other three are the welcome preview's window traffic lights,
            // coloured from WelcomePreview.svelte's own <style> block — that is
            // functional colour, and layout.css stays chroma 0.
            'tailwindcss/no-custom-classname': [
                'warn',
                {
                    whitelist: ['reading-font', 'close', 'minimise', 'maximise']
                }
            ]
        }
    },
    {
        rules: {
            // On, and it must stay on. A bare `goto('/edit')` is origin-
            // absolute, so on GitHub Pages — served from `/dyslexicwriter/` —
            // it walks out of the base path and lands on GitHub's own 404
            // instead of the editor. Every internal navigation goes through
            // `resolve()` from `$app/paths`.
            'svelte/no-navigation-without-resolve': 'error',
            // Allow an underscore prefix to mark something deliberately unused —
            // chiefly destructuring a key out of an object to drop it, as the
            // Storybook stories do to keep `children` out of a props spread.
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    ignoreRestSiblings: true
                }
            ]
        }
    },
    // House rule: the `class`/`className` prop is the styling escape hatch and
    // must be the LAST entry in a `$props()` destructure (and its type literal).
    // The rest of the ordering is semantic (by prominence) and stays a judgment
    // call — see the `ui-components` skill. We can only mechanically pin `class`.
    // Report-only (no autofix): moving it also means moving its type sibling, so
    // a human makes the edit. Selectors match a `class` key that has any sibling
    // after it inside a `$props()` destructure.
    {
        files: ['**/*.svelte', '**/*.svelte.ts'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "VariableDeclarator[init.callee.name='$props'] > ObjectPattern > Property[key.name='class'] ~ Property",
                    message:
                        'The `class`/`className` prop must be the last entry in the $props() destructure.'
                },
                {
                    selector:
                        "VariableDeclarator[init.callee.name='$props'] > ObjectPattern > TSTypeAnnotation > TSTypeLiteral > TSPropertySignature[key.name='class'] ~ TSPropertySignature",
                    message:
                        'The `class`/`className` prop must be the last entry in the $props() type annotation.'
                }
            ]
        }
    }
);
