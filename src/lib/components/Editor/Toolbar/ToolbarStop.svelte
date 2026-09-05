<script lang="ts">
    import { StopIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    import ToolbarTransportButton from './ToolbarTransportButton.svelte';

    // `pause()` leaves isPlaying true, so this stays enabled while paused — which
    // is the whole point: it's the only way out of a paused read.
    //
    // `controller` defaults to the app's one controller — it is a prop only so a
    // story or a test can drive the button from a chosen playback state. The same
    // is true of the other three transport buttons.
    let { controller = speech }: { controller?: TtsTransport } = $props();
</script>

<ToolbarTransportButton
    label={m.content_tts_stop()}
    hint={m.content_tts_stop_hint()}
    value="stop"
    disabled={!controller.isPlaying}
    onClick={() => controller.stop()}
>
    <Icon icon={StopIcon} />
</ToolbarTransportButton>
