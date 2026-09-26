<script lang="ts">
    import {
        Image01Icon,
        Link01Icon,
        PlusSignIcon,
        TableIcon
    } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import { insertPickedImage, insertTable } from './commands';
    import FormatMenu from './FormatMenu.svelte';
    import FormatMenuItem from './FormatMenuItem.svelte';

    // Table, image and link: one-shot inserts, so plain action items and a
    // trigger with no pressed state.
    let {
        disabled,
        editor,
        onPick,
        onOpenLink
    }: {
        disabled: boolean;
        editor: Editor | undefined;
        // Writes the chosen file into the document's own folder and returns the
        // relative path to reference it by (or null if the write failed).
        onPick: (file: File) => Promise<string | null>;
        // The link dialog belongs to the page, because ⌘K and a link card's
        // Edit open the same one — so this only asks for it.
        onOpenLink: () => void;
    } = $props();

    let input = $state<HTMLInputElement>();

    async function onChange(event: Event) {
        const target = event.currentTarget as HTMLInputElement;
        const file = target.files?.[0];
        // Reset immediately so picking the same file twice still fires a change.
        target.value = '';
        if (!file) return;

        await insertPickedImage(editor, file, onPick);
    }
</script>

<FormatMenu {disabled} name={m.content_format_insert_hint()}>
    {#snippet trigger()}
        <Icon icon={PlusSignIcon} />
    {/snippet}
    <FormatMenuItem
        icon={TableIcon}
        kind="action"
        label={m.content_format_table()}
        onSelect={() => insertTable(editor)}
    />
    <!-- A file picker opens only on a user gesture. `onSelect` runs inside the
         click or keypress that chose the item, before the menu closes, so the
         picker is asked for while that gesture still counts. -->
    <FormatMenuItem
        icon={Image01Icon}
        kind="action"
        label={m.content_format_image()}
        onSelect={() => input?.click()}
    />
    <FormatMenuItem
        icon={Link01Icon}
        kind="action"
        label={m.content_format_link()}
        onSelect={onOpenLink}
        shortcut={['Mod', 'K']}
    />
</FormatMenu>

<!-- Outside the menu's content, which unmounts as the menu closes: the input
     has to outlive it to hear which file was picked. -->
<input
    bind:this={input}
    accept="image/*"
    class="hidden"
    onchange={onChange}
    type="file"
/>
