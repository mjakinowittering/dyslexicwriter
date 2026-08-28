<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, userEvent } from 'storybook/test';

    import ToolbarSettings from '$lib/components/Editor/Toolbar/ToolbarSettings.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarSettings',
        component: ToolbarSettings,
        tags: ['autodocs'],
        argTypes: {
            open: { control: 'boolean' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The gear button in the editor header. It owns nothing but a bindable `open` flag — the page renders `SettingsPanel` from it, so the button only reports its state through `aria-expanded`.'
                }
            }
        }
    });
</script>

<script lang="ts">
    // Storybook args are one-way, so the toggled-open state needs a local binding
    // rather than an arg — the pattern `Editor.stories.svelte` uses for `editor`.
    let open = $state(false);
</script>

<Story
    name="Default"
    play={async ({ canvas }) => {
        const button = canvas.getByRole('button', { name: m.settings_title() });
        await expect(button).toHaveAttribute('aria-expanded', 'false');

        await userEvent.click(button);
        await expect(button).toHaveAttribute('aria-expanded', 'true');

        // And back — the button is a toggle, not a one-way open.
        await userEvent.click(button);
        await expect(button).toHaveAttribute('aria-expanded', 'false');
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarSettings bind:open />
        </div>
    {/snippet}
</Story>

<Story name="Open">
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarSettings open={true} />
        </div>
    {/snippet}
</Story>
