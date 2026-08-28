<script lang="ts">
    import type { Editor as TipTapEditor } from '@tiptap/core';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { onDestroy, onMount } from 'svelte';

    import * as Format from '$lib/components/Editor/Format';
    import * as Page from '$lib/components/Editor/Page';
    import * as Statusbar from '$lib/components/Editor/Statusbar';
    import * as Toolbar from '$lib/components/Editor/Toolbar';
    import Logo from '$lib/components/Editor/Toolbar/ToolbarLogo.svelte';
    import Rail from '$lib/components/Editor/Toolbar/ToolbarRail.svelte';
    import Settings from '$lib/components/Editor/Toolbar/ToolbarSettings.svelte';
    import * as SettingsPanel from '$lib/components/Settings';
    import Input from '$lib/components/ui/input/input.svelte';

    import { isFileSystemAccessSupported } from '$lib/fs';
    import { TITLE_MAX_LENGTH } from '$lib/models/document.model';
    import type { TtsPreferences } from '$lib/models/tts.model';
    import * as m from '$lib/paraglide/messages';
    import { doc } from '$lib/stores/document.svelte';
    import { workspace } from '$lib/stores/workspace.svelte';
    import { speech } from '$lib/tts/speech-controller.svelte';

    let editor = $state<TipTapEditor>();
    let settingsOpen = $state(false);
    let title = $state('');

    // The markdown file's path relative to the working folder — `notes.md`,
    // `Chapters/One.md`. A bare folder name from an older link still resolves.
    const path = $derived(page.url.searchParams.get('doc'));

    onMount(async () => {
        if (!isFileSystemAccessSupported()) {
            await goto('/');
            return;
        }

        // Ask for the voice list before anything awaits: engines populate it
        // asynchronously, and getVoices() is empty until they do.
        speech.loadVoices();

        if (workspace.status === 'loading') await workspace.restore();
        if (workspace.status !== 'ready') {
            await goto('/');
            return;
        }

        // Read-aloud voice and speed come from config.json, so they travel with
        // the user's folder rather than living in this browser.
        speech.applyPreferences(workspace.config.tts);

        if (path) await doc.open(path);
        else if (!doc.contentJson) await doc.createNew();

        title = doc.title;
    });

    // Every exit path flushes. The debounce is an optimisation; these are what
    // actually guarantee a keystroke reaches the disk.
    function onPageHide() {
        void doc.flush();
    }

    function onVisibilityChange() {
        if (document.visibilityState === 'hidden') void doc.flush();
    }

    onDestroy(() => {
        // Audio would otherwise bleed into the next document and the highlight
        // would target a destroyed view.
        speech.stop();
        speech.unloadVoices();
        void doc.close();
    });

    async function onBack() {
        await doc.flush();
        await goto('/');
    }

    function persistTtsPreferences(prefs: TtsPreferences) {
        void workspace.setTtsPreferences(prefs);
    }

    const wordCount = $derived(doc.wordCount);
    const disabled = $derived(!editor);
</script>

<svelte:head>
    <title>{doc.title || m.editor_untitled()}</title>
</svelte:head>

<svelte:window onpagehide={onPageHide} />
<svelte:document onvisibilitychange={onVisibilityChange} />

<!-- The settings panel takes a column beside everything else rather than
     floating above it, so opening it compresses the editor to the left. -->
<div class="flex h-full">
    <div class="flex min-w-0 flex-1 flex-col">
        <!-- Rail spans the full height of the title row AND the toolbar row. -->
        <div class="border-border flex shrink-0 gap-3 border-b">
            <Rail {onBack} />
            <Logo />
            <div class="flex min-w-0 flex-1 flex-col">
                <div class="flex h-14 items-center gap-2 px-3">
                    <!-- Quiet at rest so the header stays calm; the border
                         appears on hover and the ring on focus, so the title is
                         still recognisably a field. -->
                    <Toolbar.Title>
                        <Input
                            aria-label={m.editor_title_label()}
                            class="hover:border-input h-9 border-transparent bg-transparent text-base font-medium dark:bg-transparent"
                            maxlength={TITLE_MAX_LENGTH}
                            onchange={() => doc.rename(title)}
                            onblur={() => doc.rename(title)}
                            placeholder={m.content_title_placeholder()}
                            bind:value={title}
                        />
                    </Toolbar.Title>
                    <div class="ml-auto">
                        <Settings bind:open={settingsOpen} />
                    </div>
                </div>

                <div class="flex items-center gap-2 px-3 pb-2">
                    <Format.Root>
                        <Format.Group bind:formatting={doc.formatting}>
                            <Format.Heading {disabled} {editor} level={1} />
                            <Format.Heading {disabled} {editor} level={2} />
                            <Format.Heading {disabled} {editor} level={3} />
                            <Format.Heading {disabled} {editor} level={4} />
                        </Format.Group>
                        <Format.Group bind:formatting={doc.formatting}>
                            <Format.Bold {disabled} {editor} />
                            <Format.Italic {disabled} {editor} />
                        </Format.Group>
                        <Format.Group bind:formatting={doc.formatting}>
                            <Format.BulletList {disabled} {editor} />
                            <Format.OrderedList {disabled} {editor} />
                        </Format.Group>
                        <Format.Group bind:formatting={doc.formatting}>
                            <Format.Blockquote {disabled} {editor} />
                            <Format.HorizontalRule {disabled} {editor} />
                        </Format.Group>
                        <Format.Group>
                            <Format.InsertTable {disabled} {editor} />
                            <Format.InsertImage
                                {disabled}
                                {editor}
                                onPick={(file) => doc.addImage(file)}
                            />
                        </Format.Group>
                    </Format.Root>

                    <!-- Read-aloud transport, right-aligned on the toolbar row. -->
                    <div class="ml-auto">
                        <Toolbar.Tts
                            {disabled}
                            {editor}
                            persist={persistTtsPreferences}
                        />
                    </div>
                </div>
            </div>
        </div>

        {#if doc.error}
            <p class="text-destructive px-4 py-2 text-sm">{doc.error}</p>
        {/if}

        <Page.Root narrow={settingsOpen}>
            <Page.Editor
                bind:editor
                bind:wordCount={doc.wordCount}
                class="flex flex-1 flex-col"
                content={doc.contentJson}
                font={workspace.font}
                onBlur={() => doc.flush()}
                onDropImage={(file) => doc.addImage(file)}
                onTransaction={(e) => {
                    doc.formatting = Format.getFormattingActive(e);
                }}
                onUpdate={() => {
                    if (editor) doc.applyEdit(editor.getJSON());
                }}
            />
        </Page.Root>

        <Statusbar.Root
            error={doc.error}
            savedAt={doc.savedAt}
            saveState={doc.saveState}
            {wordCount}
        />
    </div>

    {#if settingsOpen}
        <SettingsPanel.Panel bind:open={settingsOpen} />
    {/if}
</div>
