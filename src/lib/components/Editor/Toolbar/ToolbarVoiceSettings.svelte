<script lang="ts">
    import { Settings02Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as Tooltip from '$lib/components/Tooltip';
    import { Button } from '$lib/components/ui/button';
    import { Label } from '$lib/components/ui/label';
    import * as Popover from '$lib/components/ui/popover';
    import * as Select from '$lib/components/ui/select';
    import { Slider } from '$lib/components/ui/slider';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    import { defaultPreferences } from '$lib/models/config.model';
    import { TTS_RATE_MAX, TTS_RATE_MIN } from '$lib/models/tts.model';
    import type { TtsPreferences } from '$lib/models/tts.model';
    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    // Persist the current preferences to the profile. Debounced below so dragging
    // the speed slider doesn't fire a command per tick. `open` is bindable so the
    // enclosing toggle group can light the trigger while the popover is showing.
    // `controller` defaults to the app's one controller — it is a prop only so a
    // story or a test can supply a voice list and a chosen speed.
    let {
        open = $bindable(false),
        persist,
        controller = speech
    }: {
        open?: boolean;
        persist: (prefs: TtsPreferences) => void;
        controller?: TtsTransport;
    } = $props();

    // What Reset reverts to — the shipped rate from `src/lib/config/defaults.json`,
    // the same value the controller resets to, so the button can't offer itself
    // while already at the default.
    const defaultRate = defaultPreferences().tts.rate;

    let timer: ReturnType<typeof setTimeout> | undefined;
    function persistDebounced(): void {
        clearTimeout(timer);
        timer = setTimeout(() => persist(controller.preferences), 400);
    }

    // Select uses '' as the sentinel for "suggested default" (voiceUri = null).
    const voiceValue = $derived(controller.voiceUri ?? '');
    const voiceLabel = $derived(
        controller.voices.find((v) => v.voiceURI === controller.voiceUri)
            ?.name ?? m.content_tts_voice_default()
    );

    function onVoiceChange(value: string): void {
        controller.voiceUri = value === '' ? null : value;
        persistDebounced();
    }

    function onSpeedChange(value: number): void {
        controller.rate = value;
        persistDebounced();
    }

    function onReset(): void {
        controller.resetToDefaults();
        persistDebounced();
    }
</script>

<Popover.Root bind:open>
    <Tooltip.Provider>
        <Tooltip.Root>
            <Tooltip.Trigger>
                {#snippet child({ props: tooltipProps })}
                    <Popover.Trigger>
                        {#snippet child({ props: popoverProps })}
                            <ToggleGroup.Item
                                {...tooltipProps}
                                {...popoverProps}
                                aria-label={m.content_tts_settings()}
                                value="voice"
                            >
                                <Icon icon={Settings02Icon} />
                            </ToggleGroup.Item>
                        {/snippet}
                    </Popover.Trigger>
                {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content side="bottom">
                <p>{m.content_tts_settings_hint()}</p>
            </Tooltip.Content>
        </Tooltip.Root>
    </Tooltip.Provider>

    <Popover.Content side="bottom" align="end" class="w-72">
        <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
                <Label>{m.content_tts_voice()}</Label>
                <Select.Root
                    type="single"
                    value={voiceValue}
                    onValueChange={onVoiceChange}
                >
                    <Select.Trigger class="w-full">
                        {voiceLabel}
                    </Select.Trigger>
                    <Select.Content>
                        {#if controller.voices.length === 0}
                            <Select.Item value="" disabled
                                >{m.content_tts_voice_none()}</Select.Item
                            >
                        {:else}
                            <Select.Item
                                value=""
                                label={m.content_tts_voice_default()}
                            />
                            {#each controller.voices as voice (voice.voiceURI)}
                                <Select.Item
                                    value={voice.voiceURI}
                                    label={voice.name}
                                />
                            {/each}
                        {/if}
                    </Select.Content>
                </Select.Root>
            </div>

            <div class="flex flex-col gap-1.5">
                <Label>
                    {m.content_tts_speed()}
                    <span class="text-muted-foreground"
                        >{controller.rate.toFixed(1)}×</span
                    >
                </Label>
                <!-- The name has to go on the thumb: it is the element with
                     role="slider", and the <Label> above cannot reach it — `for`
                     names form controls, not a span. -->
                <Slider
                    thumbProps={{ 'aria-label': m.content_tts_speed() }}
                    type="single"
                    value={controller.rate}
                    min={TTS_RATE_MIN}
                    max={TTS_RATE_MAX}
                    step={0.1}
                    onValueChange={onSpeedChange}
                />
            </div>

            <Button
                variant="ghost"
                size="sm"
                class="self-start"
                disabled={controller.voiceUri === null &&
                    controller.rate === defaultRate}
                onclick={onReset}
            >
                {m.content_tts_reset()}
            </Button>
        </div>
    </Popover.Content>
</Popover.Root>
