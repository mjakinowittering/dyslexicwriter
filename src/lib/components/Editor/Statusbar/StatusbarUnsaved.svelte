<script lang="ts">
    import { RecordIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import type { SaveState } from '$lib/stores/document.svelte';

    // "There is writing here the disk has not seen." Autosave waits a few seconds
    // for a pause, so this comes up whenever a sentence is being written and goes
    // again shortly after it stops — which is the point: the writer should never
    // have to wonder, and never has to look anywhere else to find out. Its sibling
    // says how old the copy on disk is; this one only says whether that copy is
    // behind.
    //
    // A step darker than the rest of the bar so it registers, but not `destructive`
    // — pending is the normal state of a document being written, not a failure.
    let { saveState = 'idle' }: { saveState?: SaveState } = $props();
</script>

{#if saveState === 'pending'}
    <div class="text-foreground flex items-center gap-2">
        <Icon class="size-3" icon={RecordIcon} />
        <span>{m.editor_unsaved()}</span>
    </div>
{/if}
