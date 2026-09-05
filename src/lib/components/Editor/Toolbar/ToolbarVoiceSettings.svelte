<script lang="ts">
    import { PreferenceHorizontalIcon } from '@hugeicons/core-free-icons';
    import { onDestroy } from 'svelte';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Label } from '$lib/components/ui/label';
    import * as Popover from '$lib/components/ui/popover';
    import * as Select from '$lib/components/ui/select';
    import * as ToggleGroup from '$lib/components/ui/toggle-group';
    import * as Tooltip from '$lib/components/ui/tooltip';

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
        timer = setTimeout(() => {
            timer = undefined;
            persist(controller.preferences);
        }, 400);
    }

    // The debounce is an optimisation; this is what makes the write actually
    // happen. Leaving the editor within 400ms of choosing a voice — Back, or a
    // document switch — would otherwise drop the choice on the floor, and the
    // pending timer would fire from a destroyed component. Flush, don't cancel.
    onDestroy(() => {
        if (timer === undefined) return;
        clearTimeout(timer);
        timer = undefined;
        persist(controller.preferences);
    });

    // Select uses '' as the sentinel for "suggested default" (voiceUri = null).
    const voiceValue = $derived(controller.voiceUri ?? '');
    const voiceLabel = $derived(
        controller.voices.find((v) => v.voiceURI === controller.voiceUri)
            ?.name ?? m.content_tts_voice_default()
    );

    // Voices are split by where they run, because that is what decides whether the
    // reading highlights each word: word highlighting comes only from the engine's
    // own boundary reports, and an internet voice sends none. A name alone gives
    // the writer no way to tell the two apart, and the suggested default already
    // prefers an on-device voice — this is what makes that choice legible, and
    // reversible for someone who prefers how an internet voice sounds.
    const localVoices = $derived(
        controller.voices.filter((v) => v.localService)
    );
    const networkVoices = $derived(
        controller.voices.filter((v) => !v.localService)
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

<!-- No `Tooltip.Provider`: `ToolbarTts` provides one for the whole transport. -->
<Popover.Root bind:open>
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
                            <Icon icon={PreferenceHorizontalIcon} />
                        </ToggleGroup.Item>
                    {/snippet}
                </Popover.Trigger>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <p>{m.content_tts_settings_hint()}</p>
        </Tooltip.Content>
    </Tooltip.Root>

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
                    <!-- The list is a `role="listbox"`, which takes no name from
                         the options inside it, and the Label above sits beside the
                         control rather than on it. Named here rather than in the
                         copied shadcn component, which a library update would
                         overwrite. -->
                    <Select.Content aria-label={m.content_tts_voice()}>
                        {#if controller.voices.length === 0}
                            <Select.Item value="" disabled
                                >{m.content_tts_voice_none()}</Select.Item
                            >
                        {:else}
                            <Select.Item
                                value=""
                                label={m.content_tts_voice_default()}
                            />
                            <!-- A group is drawn only when it has voices in it: a
                                 machine with no internet voices shouldn't be told
                                 about a distinction that doesn't apply to it. -->
                            {#if localVoices.length > 0}
                                <Select.Group>
                                    <Select.GroupHeading>
                                        {m.content_tts_voice_group_local()}
                                    </Select.GroupHeading>
                                    {#each localVoices as voice (voice.voiceURI)}
                                        <Select.Item
                                            value={voice.voiceURI}
                                            label={voice.name}
                                        />
                                    {/each}
                                </Select.Group>
                            {/if}
                            {#if networkVoices.length > 0}
                                <Select.Group>
                                    <Select.GroupHeading>
                                        {m.content_tts_voice_group_network()}
                                    </Select.GroupHeading>
                                    {#each networkVoices as voice (voice.voiceURI)}
                                        <Select.Item
                                            value={voice.voiceURI}
                                            label={voice.name}
                                        />
                                    {/each}
                                </Select.Group>
                            {/if}
                        {/if}
                    </Select.Content>
                </Select.Root>
                {#if networkVoices.length > 0}
                    <p class="text-muted-foreground text-xs">
                        {m.content_tts_voice_network_note()}
                    </p>
                {/if}
            </div>

            <div class="flex flex-col gap-1.5">
                <Label>
                    {m.content_tts_speed()}
                    <!-- Through the presets' own message, so the heading and the
                         pressed button can't disagree: `toFixed(1)` rounded the
                         slowest preset to "0.8×" while the button under it said
                         "0.75×". Two decimals, trailing zeros dropped, so a
                         hand-edited config.json still reads as a speed. -->
                    <span class="text-muted-foreground">
                        {m.content_tts_speed_option({
                            rate: Number(controller.rate.toFixed(2))
                        })}
                    </span>
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
