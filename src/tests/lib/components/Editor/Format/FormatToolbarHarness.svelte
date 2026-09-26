<script lang="ts">
    import { Editor, type JSONContent } from '@tiptap/core';
    import { onMount, untrack } from 'svelte';

    import * as Format from '$lib/components/Editor/Format';
    import * as Link from '$lib/components/Editor/Link';
    import * as SettingsPanel from '$lib/components/Settings';

    import { documentExtensions } from '$lib/markdown/extensions';
    import type { PreferenceStore } from '$lib/stores/workspace.svelte';

    // The formatting row as the edit page wires it — the four menus, the
    // bold/italic/code group and ¶ — against a real editor, with the link dialog
    // and the Settings panel beside it. `active` is kept current from the
    // editor's transactions, the way the page keeps `doc.formatting`.
    let {
        content,
        store,
        onPick,
        onReady
    }: {
        content: JSONContent;
        store: PreferenceStore;
        onPick: (file: File) => Promise<string | null>;
        onReady: (editor: Editor) => void;
    } = $props();

    let element: HTMLDivElement;
    let editor = $state.raw<Editor>();
    let active = $state<string[]>([]);
    let linkOpen = $state(false);
    let settingsOpen = $state(true);

    onMount(() => {
        const instance = new Editor({
            element,
            extensions: documentExtensions({ trailingNode: true }),
            content: untrack(() => content),
            onTransaction: ({ editor: e }) => {
                active = Format.getFormattingActive(e);
            }
        });
        editor = instance;
        active = Format.getFormattingActive(instance);
        untrack(() => onReady(instance));
        return () => instance.destroy();
    });
</script>

<Format.Root>
    <Format.TextStyle {active} disabled={false} {editor} />
    <Format.Group bind:formatting={active}>
        <Format.Bold disabled={false} {editor} />
        <Format.Italic disabled={false} {editor} />
        <Format.Code disabled={false} {editor} />
    </Format.Group>
    <Format.Lists {active} disabled={false} {editor} />
    <Format.Blocks {active} disabled={false} {editor} />
    <Format.InsertMenu
        disabled={false}
        {editor}
        onOpenLink={() => (linkOpen = true)}
        {onPick}
    />
    <Format.Invisibles {store} />
</Format.Root>

<div bind:this={element} data-testid="editor"></div>

<Link.Dialog bind:open={linkOpen} {editor} />
<SettingsPanel.Panel bind:open={settingsOpen} {store} />
