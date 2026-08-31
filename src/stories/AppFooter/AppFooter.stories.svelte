<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import AppFooter from '$lib/components/AppFooter/AppFooter.svelte';

    import {
        authorUrl,
        licenseUrl,
        openDyslexicUrl,
        repositoryUrl
    } from '$lib/config/links';
    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'AppFooter/AppFooter',
        component: AppFooter,
        tags: ['autodocs'],
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The other half of the app chrome for `/`, shown below every state of it — the unsupported-browser screen, the folder picker and the Files list alike. Takes no props: the licence and repository URLs are derived from package.json, and everything else is copy. The editor has no footer; it is the distraction-free surface. Rendered in both themes here because the a11y checks run twice, and an underlined link on a neutral grey ground is the whole of what distinguishes it from the sentence beside it.'
                }
            }
        }
    });
</script>

<!-- One story: the component has no props and no states, so what is worth
     asserting is that the landmark, the copy and both links are there — and that
     axe passes over it in each theme. -->
<Story
    name="Default"
    play={async ({ canvas }) => {
        // A single contentinfo landmark, which is what makes this navigable
        // rather than a strip of small text at the bottom.
        await expect(canvas.getByRole('contentinfo')).toBeVisible();

        // The note is assembled from four runs of copy around two links, so
        // assert the sentence it actually renders rather than any one run — a
        // stray or missing space between the runs is the thing that breaks.
        await expect(
            canvas.getByRole('contentinfo').textContent?.replace(/\s+/g, ' ')
        ).toContain(
            `${m.footer_note_start()} ${m.footer_author()} ${m.footer_note_middle()} ${m.footer_opendyslexic()}${m.footer_note_end()}`
        );

        // Every link points outward, and the licence one at the file rather
        // than the repository root.
        await expect(
            canvas.getByRole('link', { name: m.footer_author() })
        ).toHaveAttribute('href', authorUrl);
        await expect(
            canvas.getByRole('link', { name: m.footer_opendyslexic() })
        ).toHaveAttribute('href', openDyslexicUrl);
        await expect(
            canvas.getByRole('link', { name: m.footer_license() })
        ).toHaveAttribute('href', licenseUrl);
        await expect(
            canvas.getByRole('link', { name: m.footer_github() })
        ).toHaveAttribute('href', repositoryUrl);
    }}
/>
