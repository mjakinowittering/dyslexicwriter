<script lang="ts">
    import { Image01Icon } from '@hugeicons/core-free-icons';
    import type { Editor } from '@tiptap/core';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';

    import FormatInsert from './FormatInsert.svelte';

    let {
        disabled,
        editor,
        onPick
    }: {
        disabled: boolean;
        editor: Editor | undefined;
        // Writes the chosen file into the document's own folder and returns the
        // relative path to reference it by (or null if the write failed).
        onPick: (file: File) => Promise<string | null>;
    } = $props();

    let input = $state<HTMLInputElement>();

    async function onChange(event: Event) {
        const target = event.currentTarget as HTMLInputElement;
        const file = target.files?.[0];
        // Reset immediately so picking the same file twice still fires a change.
        target.value = '';
        if (!file) return;

        const src = await onPick(file);
        if (src)
            editor?.chain().focus().setImage({ src, alt: file.name }).run();
    }
</script>

<FormatInsert
    ariaLabel={m.content_format_image()}
    {disabled}
    onClick={() => input?.click()}
    tooltip={m.content_format_image_hint()}
>
    <Icon icon={Image01Icon} />
</FormatInsert>

<input
    bind:this={input}
    accept="image/*"
    class="hidden"
    onchange={onChange}
    type="file"
/>
