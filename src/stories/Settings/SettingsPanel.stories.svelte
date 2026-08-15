<script lang="ts" module>
    import { makePreferences } from '../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, userEvent } from 'storybook/test';

    import SettingsPanel from '$lib/components/Settings/SettingsPanel.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Settings/SettingsPanel',
        component: SettingsPanel,
        tags: ['autodocs'],
        argTypes: {
            open: { control: 'boolean' },
            store: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The settings panel — font and theme. Every control writes straight through to config.json in the user’s folder, so there is no separate save. It takes a column in the editor’s grid rather than floating, and reveals in two phases: the panel slides open on the x axis, then the controls fade in. `store` defaults to the real workspace; these stories pass a stand-in so there is no folder involved.'
                }
            }
        }
    });
</script>

<script lang="ts">
    // One store per story, so a play can assert against the setter it just moved.
    const light = makePreferences({ theme: 'light', font: 'sans' });
    const dark = makePreferences({ theme: 'dark', font: 'dyslexic' });
    const closable = makePreferences();

    let open = $state(true);
</script>

<Story
    name="Default"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('radio', { name: m.settings_font_sans() })
        ).toBeChecked();

        // The font choice writes through the store, and the panel follows it.
        await userEvent.click(
            canvas.getByRole('radio', { name: m.settings_font_dyslexic() })
        );
        await expect(light.setFont).toHaveBeenCalledWith('dyslexic');
        await expect(
            canvas.getByRole('radio', { name: m.settings_font_dyslexic() })
        ).toBeChecked();
    }}
>
    {#snippet template()}
        <div class="bg-background flex h-96 w-full justify-end">
            <SettingsPanel open={true} store={light} />
        </div>
    {/snippet}
</Story>

<Story
    name="Dark + Reading Font"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('radio', { name: m.settings_font_dyslexic() })
        ).toBeChecked();

        // The switch is on in dark, and its label names the theme in force.
        const toggle = canvas.getByRole('switch', {
            name: m.settings_theme_dark()
        });
        await expect(toggle).toBeChecked();

        await userEvent.click(toggle);
        await expect(dark.setTheme).toHaveBeenCalledWith('light');
    }}
>
    {#snippet template()}
        <div class="bg-background flex h-96 w-full justify-end">
            <SettingsPanel open={true} store={dark} />
        </div>
    {/snippet}
</Story>

<Story
    name="Closing"
    play={async ({ canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', { name: m.settings_close() })
        );
        // `open` is bindable: the close button reports outwards rather than
        // unmounting itself, because the page owns the column.
        await expect(open).toBe(false);
    }}
>
    {#snippet template()}
        <div class="bg-background flex h-96 w-full justify-end">
            <SettingsPanel bind:open store={closable} />
        </div>
    {/snippet}
</Story>
