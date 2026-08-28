<script lang="ts">
    import { MinusSignIcon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatToggle from './FormatToggle.svelte';

    let {
        disabled,
        editor
    }: { disabled: boolean; editor: Editor | undefined } = $props();

    const onClick = () => {
        editor?.chain().focus().setHorizontalRule().run();
    };
</script>

<FormatToggle
    ariaLabel={m.content_format_horizontal_rule()}
    {disabled}
    {onClick}
    tooltip={m.content_format_horizontal_rule_hint()}
    value="horizontalRule"
>
    <Icon icon={MinusSignIcon} />
</FormatToggle>
