<script lang="ts">
    import { Editor } from '@tiptap/core';
    import { onDestroy } from 'svelte';

    import ToolbarReadAloud from '$lib/components/Editor/Toolbar/ToolbarReadAloud.svelte';
    import ToolbarTts from '$lib/components/Editor/Toolbar/ToolbarTts.svelte';

    import { documentExtensions } from '$lib/markdown/extensions';
    import { ReadAloudBar } from '$lib/tts/read-aloud-bar.svelte';
    import type { TtsTransport } from '$lib/tts/speech-controller.svelte';

    // The launcher and the bar, wired as the edit page wires them.
    let { controller }: { controller: TtsTransport } = $props();

    // svelte-ignore state_referenced_locally
    const bar = new ReadAloudBar(controller);
    let button = $state<HTMLElement | null>(null);

    // A live editor, as the page always has one: without it Play is disabled,
    // and a disabled button cannot take the focus the bar hands it.
    const editor = new Editor({
        extensions: documentExtensions(),
        content: '<p>Some prose.</p>'
    });
    onDestroy(() => editor.destroy());

    function close() {
        bar.close();
        button?.focus();
    }
</script>

<ToolbarReadAloud
    bind:ref={button}
    onOpenChange={(open) => (open ? bar.launch() : bar.close())}
    open={bar.open}
/>

{#if bar.open}
    <ToolbarTts
        autofocus
        {controller}
        {editor}
        onClose={close}
        persist={() => {}}
    />
{/if}
