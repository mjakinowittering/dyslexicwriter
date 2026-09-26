<script lang="ts" module>
    import { makePreferences } from '../../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, userEvent } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatInvisibles from '$lib/components/Editor/Format/FormatInvisibles.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatInvisibles',
        component: FormatInvisibles,
        tags: ['autodocs'],
        argTypes: {
            store: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        '¶ — show invisible characters. The same `showInvisibles` preference as the Settings panel’s switch, in config.json, reached from the toolbar. `store` defaults to the real workspace; these stories pass a stand-in.'
                }
            }
        }
    });
</script>

<script lang="ts">
    const off = makePreferences();
    const on = makePreferences({ showInvisibles: true });
</script>

<Story
    name="Off"
    play={async ({ canvas }) => {
        const pilcrow = canvas.getByRole('button', {
            name: m.settings_invisibles_show()
        });
        await expect(pilcrow).toHaveAttribute('aria-pressed', 'false');

        // Writes through the store, and follows it.
        await userEvent.click(pilcrow);
        await expect(off.setShowInvisibles).toHaveBeenCalledWith(true);
        await expect(pilcrow).toHaveAttribute('aria-pressed', 'true');
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatInvisibles store={off} />
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="On"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.settings_invisibles_show() })
        ).toHaveAttribute('aria-pressed', 'true');
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatInvisibles store={on} />
            </Format>
        </div>
    {/snippet}
</Story>
