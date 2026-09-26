<script lang="ts">
    import { StopIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    import ToolbarTransportButton from './ToolbarTransportButton.svelte';

    // Stop leaves the page where it is, deliberately: the writer carries on from
    // the last thing they heard.
    //
    // With `onStop` it also puts the read-aloud bar away, so it stays live when
    // nothing is playing — it is the way to dismiss a bar opened by mistake.
    let {
        onStop,
        controller = speech
    }: { onStop?: () => void; controller?: TtsTransport } = $props();
</script>

<ToolbarTransportButton
    label={m.content_tts_stop()}
    hint={m.content_tts_stop_hint()}
    value="stop"
    disabled={!onStop && !controller.isPlaying}
    onClick={() => {
        controller.stop();
        onStop?.();
    }}
>
    <Icon icon={StopIcon} />
</ToolbarTransportButton>
