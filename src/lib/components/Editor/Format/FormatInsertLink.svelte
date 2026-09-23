<script lang="ts">
    import { Link01Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatInsert from './FormatInsert.svelte';

    // Opens the link dialog. The dialog belongs to the page rather than to this
    // button, because ⌘K and a link card's Edit open the same one — so this only
    // asks for it.
    //
    // Not a row in definitions.ts: that table is the stateful toggles, and an
    // insert has no pressed state to report, the same as the image control.
    let {
        disabled,
        onOpen
    }: {
        disabled: boolean;
        onOpen: () => void;
    } = $props();
</script>

<FormatInsert
    ariaLabel={m.content_format_link()}
    {disabled}
    onClick={onOpen}
    shortcut={['Mod', 'K']}
    tooltip={m.content_format_link_hint()}
>
    <Icon icon={Link01Icon} />
</FormatInsert>
