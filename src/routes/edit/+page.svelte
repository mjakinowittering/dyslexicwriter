<script lang="ts">
    import type { Editor as TipTapEditor } from '@tiptap/core';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { page } from '$app/state';
    import { onDestroy, onMount } from 'svelte';

    import * as Format from '$lib/components/Editor/Format';
    import * as Page from '$lib/components/Editor/Page';
    import * as Statusbar from '$lib/components/Editor/Statusbar';
    import * as Toolbar from '$lib/components/Editor/Toolbar';
    import Rail from '$lib/components/Editor/Toolbar/ToolbarRail.svelte';
    import Settings from '$lib/components/Editor/Toolbar/ToolbarSettings.svelte';
    import * as SettingsPanel from '$lib/components/Settings';
    import * as InputGroup from '$lib/components/ui/input-group';

    import { isFileSystemAccessSupported } from '$lib/fs';
    import {
        extensionFromFileName,
        MARKDOWN_EXTENSION,
        TITLE_MAX_LENGTH
    } from '$lib/models/document.model';
    import type { TtsPreferences } from '$lib/models/tts.model';
    import * as m from '$lib/paraglide/messages';
    import { doc } from '$lib/stores/document.svelte';
    import { workspace } from '$lib/stores/workspace.svelte';
    import { speech } from '$lib/tts/speech-controller.svelte';

    let editor = $state<TipTapEditor>();
    // The editor component itself, for `reconcile()`. The exit paths below have to
    // ask it whether it is holding anything the store has not been told about
    // before they flush — a flush is a no-op on a document the store believes is
    // clean, and an edit made from outside the editor (a browser extension
    // rewriting the text) raises no event to tell it otherwise.
    let pageEditor: ReturnType<typeof Page.Editor> | undefined;
    let settingsOpen = $state(false);
    let title = $state('');

    // Whether there is anything to undo or redo. `editor.can()` reads ProseMirror
    // state, which is not a signal, so these are refreshed from the editor's own
    // transaction callback — the same seam `doc.formatting` rides. Both start
    // false, which is exactly what a writer sees the moment a document opens.
    let canUndo = $state(false);
    let canRedo = $state(false);

    // The markdown file's path relative to the working folder — `notes.md`,
    // `Chapters/One.md`. A bare folder name from an older link still resolves.
    const path = $derived(page.url.searchParams.get('doc'));

    // The `?doc=` this page has actually opened.
    //
    // `undefined` means nothing has been opened yet, which is NOT the same as
    // `null`: null is a real value here — the URL a brand-new document is opened
    // under — and the two behave differently on the first pass.
    //
    // Deliberately a plain `let` rather than `$state`: the effect below both reads
    // and writes it, and a signal would re-trigger the effect on its own write.
    let openedPath: string | null | undefined = undefined;

    onMount(async () => {
        if (!isFileSystemAccessSupported()) {
            await goto(resolve('/'));
            return;
        }

        // Ask for the voice list before anything awaits: engines populate it
        // asynchronously, and getVoices() is empty until they do.
        speech.loadVoices();

        if (workspace.status === 'loading') await workspace.restore();
        if (workspace.status !== 'ready') {
            await goto(resolve('/'));
            return;
        }

        // Read-aloud voice and speed come from config.json, so they travel with
        // the user's folder rather than living in this browser.
        speech.applyPreferences(workspace.config.tts);
    });

    // Opening is driven by the URL rather than by mount, because SvelteKit does not
    // remount a page on same-route navigation: `/edit?doc=A` → `/edit?doc=B` would
    // otherwise leave A open under a URL naming B, and the next thing saved would
    // land in A's file. Nothing in the app navigates that way today; the first
    // "open in editor" link added anywhere arms it.
    //
    // Reads `workspace.status` as well as the path, so the first pass on a cold
    // load waits for `onMount` to restore the folder and then runs itself.
    $effect(() => {
        const next = path;
        if (workspace.status !== 'ready') return;
        if (next === openedPath) return;

        const first = openedPath === undefined;
        openedPath = next;
        void openFromUrl(next, first);
    });

    async function openFromUrl(next: string | null, first: boolean) {
        // A switch is not an unmount, so `onDestroy` will not run: the read has to
        // be stopped here or it carries on talking over the next document with the
        // highlight pointing into a document that is no longer on screen.
        //
        // Pending edits land under the document they were made in — `doc.open()`
        // resets rather than flushing, so this is what stands between a debounced
        // keystroke and the bin.
        if (!first) {
            speech.stop();
            // Ask the editor first: this flush is the last thing that runs against
            // the outgoing document, and it is a no-op on one the store believes
            // is clean. `doc.open()` resets rather than flushing, so an edit the
            // store was never told about goes in the bin here and nowhere else.
            pageEditor?.reconcile();
            await doc.flush();
        }

        if (next) await doc.open(next);
        // No document named. On the first pass that is the Files screen's "new
        // document" flow, which has already called `createNew()` and put content in
        // the store — clobbering it would throw away what the user just made.
        else if (!first || !doc.contentJson) await doc.createNew();

        // A second change overtook this one while it was reading; the title belongs
        // to whichever document is open now, not to the one we were fetching.
        if (openedPath !== next) return;

        title = doc.title;
    }

    // Every exit path flushes. The debounce is an optimisation; these are what
    // actually guarantee a keystroke reaches the disk.
    //
    // Speech stops here too. `onDestroy` covers navigating within the app, but it
    // doesn't run on a real tab close or reload — and Chrome's speech queue
    // outlives the page that started it, so a read in progress would carry on
    // talking with nothing left on screen to silence it.
    function onPageHide() {
        speech.stop();
        pageEditor?.reconcile();
        void doc.flush();
    }

    // Deliberately does not stop the read: a writer listening while they look at
    // another window is using the feature, not leaving it.
    function onVisibilityChange() {
        if (document.visibilityState !== 'hidden') return;

        pageEditor?.reconcile();
        void doc.flush();
    }

    onDestroy(() => {
        // Audio would otherwise bleed into the next document and the highlight
        // would target a destroyed view.
        speech.stop();
        speech.unloadVoices();
        // Best-effort: the child may already be torn down by the time this runs.
        // `onBack` is the in-app navigation path that reliably catches this, and
        // the editor's own heartbeat is the backstop behind both.
        pageEditor?.reconcile();
        void doc.close();
    });

    async function onBack() {
        pageEditor?.reconcile();
        await doc.flush();
        await goto(resolve('/'));
    }

    // `rename` flushes before it moves anything, so that pending edits land under
    // the OLD name. That only holds if the store knows about them: reconcile first
    // and the claim is true, skip it and the edit lands after the move instead.
    function renameFromTitle() {
        pageEditor?.reconcile();
        void doc.rename(title);
    }

    function persistTtsPreferences(prefs: TtsPreferences) {
        void workspace.setTtsPreferences(prefs);
    }

    const wordCount = $derived(doc.wordCount);
    const disabled = $derived(!editor);

    // The title field's addon: the document's own extension, read from the file
    // it was opened as rather than assumed, so a file the scan ever learns to
    // accept beyond `.md` keeps its own. An unsaved document has no file yet, and
    // shows the extension its first save is going to give it.
    const extension = $derived(
        doc.location
            ? extensionFromFileName(doc.location.file)
            : MARKDOWN_EXTENSION
    );
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
            <div class="flex min-w-0 flex-1 flex-col">
                <div class="flex h-14 items-center gap-2 px-3">
                    <!-- The title IS the filename — the markdown file's basename
                         — so the extension rides an addon beside it and the two
                         read as one name. Bordered at rest rather than quiet:
                         the field is now stating something, not just holding
                         text. -->
                    <Toolbar.Title>
                        <InputGroup.Root>
                            <InputGroup.Input
                                aria-label={m.editor_title_label()}
                                class="font-medium"
                                maxlength={TITLE_MAX_LENGTH}
                                onchange={renameFromTitle}
                                onblur={renameFromTitle}
                                placeholder={m.content_title_placeholder()}
                                bind:value={title}
                            />
                            {#if extension}
                                <InputGroup.Addon align="inline-end">
                                    {extension}
                                </InputGroup.Addon>
                            {/if}
                        </InputGroup.Root>
                    </Toolbar.Title>
                    <div class="ml-auto">
                        <Settings bind:open={settingsOpen} />
                    </div>
                </div>

                <div class="flex items-center gap-2 px-3 pb-2">
                    <Format.Root>
                        <!-- No `formatting`, so a plain button group: undoing is
                             a one-shot action with no state to report. -->
                        <Format.Group>
                            <Format.Undo
                                disabled={disabled || !canUndo}
                                {editor}
                            />
                            <Format.Redo
                                disabled={disabled || !canRedo}
                                {editor}
                            />
                        </Format.Group>
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

        <!-- `reading` is what puts the back-to-top button on the canvas: the read
             has been following the voice down the page, so there has to be a way
             back. Clicking it ends the read — one that carried on would scroll
             straight back to the spoken sentence. -->
        <Page.Root
            narrow={settingsOpen}
            onBackToTop={() => speech.stop()}
            reading={speech.isPlaying}
        >
            <Page.Editor
                bind:this={pageEditor}
                bind:editor
                bind:wordCount={doc.wordCount}
                class="flex flex-1 flex-col"
                content={doc.contentJson}
                font={workspace.font}
                onBlur={() => doc.flush()}
                onDropImage={(file) => doc.addImage(file)}
                onTransaction={(e) => {
                    doc.formatting = Format.getFormattingActive(e);
                    canUndo = e.can().undo();
                    canRedo = e.can().redo();
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
