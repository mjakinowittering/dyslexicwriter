<script lang="ts">
    import {
        Heading01Icon,
        Heading02Icon,
        Heading03Icon,
        Heading04Icon
    } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatToggle from './FormatToggle.svelte';

    let {
        disabled,
        editor,
        level
    }: { disabled: boolean; editor: Editor | undefined; level: 1 | 2 | 3 | 4 } =
        $props();

    const icons = {
        1: Heading01Icon,
        2: Heading02Icon,
        3: Heading03Icon,
        4: Heading04Icon
    };
    let icon = $derived(icons[level]);

    const onClick = () => {
        editor?.chain().focus().toggleHeading({ level }).run();
    };
</script>

<FormatToggle
    ariaLabel={m.content_format_heading({ level })}
    {disabled}
    {onClick}
    shortcut={['Ctrl', 'Alt', String(level)]}
    tooltip={m.content_format_heading_hint({ level })}
    value="heading{level}"
>
    <Icon {icon} />
</FormatToggle>
