<script lang="ts">
    import { NextIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    import ToolbarTransportButton from './ToolbarTransportButton.svelte';

    // Disabled on the last sentence, so skipping can't quietly end the read.
    let { controller = speech }: { controller?: TtsTransport } = $props();
</script>

<ToolbarTransportButton
    label={m.content_tts_skip_forward()}
    hint={m.content_tts_skip_forward_hint()}
    value="skip-forward"
    disabled={!controller.canSkipForward}
    onClick={() => controller.skipForward()}
>
    <Icon icon={NextIcon} />
</ToolbarTransportButton>
