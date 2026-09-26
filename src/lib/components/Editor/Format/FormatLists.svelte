<script lang="ts">
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import { applyFormat } from './commands';
    import { formatToggles, LIST_TOGGLES } from './definitions';
    import FormatMenu from './FormatMenu.svelte';
    import FormatMenuItem from './FormatMenuItem.svelte';

    // Bullet list, numbered list and checklist in one menu. The trigger shows
    // the kind of list the selection is in — a bullet when it is in none — and
    // looks pressed while it is in any. Choosing the list already in force
    // takes it off again, as the buttons it replaces did.
    let {
        active,
        disabled,
        editor
    }: {
        // `doc.formatting` — which rows of `definitions.ts` are on.
        active: string[];
        disabled: boolean;
        editor: Editor | undefined;
    } = $props();

    const current = $derived(
        LIST_TOGGLES.find((list) => active.includes(list.value))
    );
</script>

<FormatMenu
    {disabled}
    name={m.content_format_lists_hint()}
    pressed={current !== undefined}
    value={current?.hint()}
>
    {#snippet trigger()}
        <Icon icon={(current ?? formatToggles.bulletList).icon} />
    {/snippet}
    {#each LIST_TOGGLES as list (list.value)}
        <FormatMenuItem
            checked={list === current}
            icon={list.icon}
            kind="check"
            label={list.hint()}
            onSelect={() => applyFormat(editor, list)}
            shortcut={list.shortcut}
        />
    {/each}
</FormatMenu>
