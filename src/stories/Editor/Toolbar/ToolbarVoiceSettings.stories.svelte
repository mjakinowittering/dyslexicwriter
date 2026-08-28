<script lang="ts" module>
    import { FAKE_VOICES, makeTts } from '../../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, screen, userEvent } from 'storybook/test';

    import ToolbarVoiceSettings from '$lib/components/Editor/Toolbar/ToolbarVoiceSettings.svelte';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarVoiceSettings',
        component: ToolbarVoiceSettings,
        tags: ['autodocs'],
        argTypes: {
            open: { control: 'boolean' },
            persist: { control: false },
            controller: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Voice/speed settings control — a gear toggle opening a popover with a voice `Select` and four speed presets. Reads voices and rate from the TTS controller and calls the debounced `persist` on change, which writes them to config.json. `controller` defaults to the app’s controller; these stories pass a stand-in, since a browser under test has whatever voices it happens to have.'
                }
            }
        }
    });
</script>

<script lang="ts">
    const withVoices = makeTts({ voices: FAKE_VOICES });
    const noVoices = makeTts();
    const customised = makeTts({
        voices: FAKE_VOICES,
        voiceUri: 'Daniel',
        rate: 1.5
    });
</script>

<Story
    name="Default"
    play={async ({ canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', { name: m.content_tts_settings() })
        );

        // The popover is portaled to <body>, so it is off the story's own canvas.
        await expect(
            await screen.findByText(m.content_tts_voice())
        ).toBeInTheDocument();
        // Nothing customised yet, so there is nothing to reset to.
        await expect(
            screen.getByRole('button', { name: m.content_tts_reset() })
        ).toBeDisabled();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarVoiceSettings
                    controller={withVoices}
                    persist={fn()}
                    open={false}
                />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>

<!-- A voice and a speed the writer chose: Reset now has something to undo. -->
<Story
    name="Customised"
    play={async () => {
        const reset = screen.getByRole('button', {
            name: m.content_tts_reset()
        });
        await expect(reset).toBeEnabled();

        await userEvent.click(reset);
        await expect(customised.resetToDefaults).toHaveBeenCalledOnce();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarVoiceSettings
                    controller={customised}
                    persist={fn()}
                    open={true}
                />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>

<!-- Linux engines can report no voices at all; say so rather than showing an
     empty list. -->
<Story
    name="No Voices"
    play={async () => {
        await expect(
            await screen.findByText(m.content_tts_speed())
        ).toBeInTheDocument();
    }}
>
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToggleGroup.Root type="multiple" variant="outline">
                <ToolbarVoiceSettings
                    controller={noVoices}
                    persist={fn()}
                    open={true}
                />
            </ToggleGroup.Root>
        </div>
    {/snippet}
</Story>
