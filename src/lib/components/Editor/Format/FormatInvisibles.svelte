<script lang="ts">
    import { ParagraphIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import { Toggle } from '$lib/components/ui/toggle';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import * as m from '$lib/paraglide/messages';
    import {
        workspace,
        type PreferenceStore
    } from '$lib/stores/workspace.svelte';

    // ¶ — show invisible characters. The same preference as the Settings
    // panel's switch, in config.json as it always was; this is only a second
    // way to reach it, where the writer is working. Both read the store, so
    // they cannot disagree.
    //
    // `store` defaults to the app's workspace — a prop only so a story or a
    // test can drive it without a folder on disk behind it.
    let { store = workspace }: { store?: PreferenceStore } = $props();
</script>

<Tooltip.Root>
    <Tooltip.Trigger>
        {#snippet child({ props })}
            <Toggle
                {...props}
                aria-label={m.settings_invisibles_show()}
                onPressedChange={(pressed) => store.setShowInvisibles(pressed)}
                pressed={store.showInvisibles}
                variant="outline"
            >
                <Icon icon={ParagraphIcon} />
            </Toggle>
        {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom">
        <span>{m.settings_invisibles_show()}</span>
    </Tooltip.Content>
</Tooltip.Root>
