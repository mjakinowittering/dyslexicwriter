<script lang="ts">
    import { Settings02Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as Tooltip from '$lib/components/Tooltip';
    import { Button } from '$lib/components/ui/button';
    import { Label } from '$lib/components/ui/label';
    import * as Popover from '$lib/components/ui/popover';
    import * as Select from '$lib/components/ui/select';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';

    import { defaultPreferences } from '$lib/models/config.model';
    import { TTS_RATE_MAX, TTS_RATE_MIN } from '$lib/models/tts.model';
    import type { TtsPreferences } from '$lib/models/tts.model';
    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    // Persist the current preferences to the profile. Debounced below so trying a
    // couple of speeds in a row doesn't write config.json each time. `open` is
    // bindable so the enclosing toggle group can light the trigger while the
    // popover is showing.
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

    // Speed is a coarse choice, not something adjusted often, so it is four
    // buttons rather than a drag. The ends are the stored rate's own validation
    // bounds; the presets simply stop offering the values in between, which a
    // hand-edited config.json may still hold.
    const SPEED_PRESETS = [TTS_RATE_MIN, 1, 1.5, TTS_RATE_MAX] as const;

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

    // A single-select toggle group clears itself when you press the item already
    // pressed. There is no "no speed", so an empty value leaves the rate alone
    // rather than reaching Number('') and storing NaN.
    function onSpeedChange(value: string): void {
        if (value === '') return;
        controller.rate = Number(value);
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
                <!-- Each button names itself from its own text; the group needs
                     the label, since `for` names form controls, not a group. The
                     `×` is announced inconsistently, so the readable name is
                     spelled out rather than left to the glyph. -->
                <ToggleGroup.Root
                    type="single"
                    variant="outline"
                    class="w-full"
                    aria-label={m.content_tts_speed()}
                    value={String(controller.rate)}
                    onValueChange={onSpeedChange}
                >
                    {#each SPEED_PRESETS as rate (rate)}
                        <ToggleGroup.Item
                            value={String(rate)}
                            aria-label={m.content_tts_speed_option_label({
                                rate
                            })}
                            class="flex-1"
                        >
                            {m.content_tts_speed_option({ rate })}
                        </ToggleGroup.Item>
                    {/each}
                </ToggleGroup.Root>
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
