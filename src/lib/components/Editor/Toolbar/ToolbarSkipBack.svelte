<script lang="ts">
    import { PreviousIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import { speech } from '$lib/tts/speech-controller.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    import ToolbarTransportButton from './ToolbarTransportButton.svelte';

    // Media-player convention: restart the current sentence, or step back one
    // when playback has only just entered it. Enabled for the whole session,
    // including while paused.
    let { controller = speech }: { controller?: TtsTransport } = $props();
</script>

<ToolbarTransportButton
    label={m.content_tts_skip_back()}
    hint={m.content_tts_skip_back_hint()}
    value="skip-back"
    disabled={!controller.canSkipBack}
    onClick={() => controller.skipBack()}
>
    <Icon icon={PreviousIcon} />
</ToolbarTransportButton>
