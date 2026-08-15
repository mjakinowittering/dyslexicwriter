<script lang="ts">
    import { TableIcon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatInsert from './FormatInsert.svelte';

    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();

    // A 3x3 with a header row is the shape that survives the markdown
    // round-trip: GFM tables require a header.
    const onClick = () => {
        editor
            ?.chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
    };
</script>

<FormatInsert
    ariaLabel={m.content_format_table()}
    {disabled}
    {onClick}
    tooltip={m.content_format_table_hint()}
>
    <Icon icon={TableIcon} />
</FormatInsert>
