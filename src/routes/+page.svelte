<script lang="ts">
    import {
        File01Icon,
        FileAddIcon,
        FolderOpenIcon,
        FolderRemoveIcon,
        RefreshIcon
    } from '@hugeicons/core-free-icons';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    import ConfirmDialog from '$lib/components/ConfirmDialog/ConfirmDialog.svelte';
    import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
    import * as FileTree from '$lib/components/FileTree';
    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Welcome from '$lib/components/Welcome';

    import {
        deleteDocument,
        isFileSystemAccessSupported,
        SUGGESTED_FOLDER_NAME
    } from '$lib/fs';
    import {
        documentPath,
        type DocumentIndexEntry
    } from '$lib/models/document.model';
    import * as m from '$lib/paraglide/messages';
    import { doc } from '$lib/stores/document.svelte';
    import { workspace } from '$lib/stores/workspace.svelte';

    // The Files screen. Deliberately plain: a utility list, not a marketing
    // surface. Its final layout is still open, so nothing here is precious.
    //
    // Both irreversible actions here ask first, through ConfirmDialog. The
    // handler the list calls only opens the dialog; the work itself waits for the
    // confirm callback.
    let leaveOpen = $state(false);
    let deleteOpen = $state(false);
    let deleteTarget = $state<DocumentIndexEntry | null>(null);

    // Be honest about which delete this is: a document that owns its folder takes
    // the folder and its images with it, a markdown file sitting among the user's
    // own files takes only itself.
    const deleteDescription = $derived(
        deleteTarget?.ownsFolder
            ? m.files_delete_description()
            : m.files_delete_file_description()
    );

    onMount(async () => {
        if (!isFileSystemAccessSupported()) {
            workspace.status = 'unsupported';
            return;
        }

        // A first load adopts the folder, and adopting it already scans. Coming
        // back from the editor re-mounts this component with the folder long since
        // adopted, and the tree we were handed then may be several edits out of
        // date — the API has no way to tell us a file changed, so looking again
        // when the screen appears is the only way this list stays true.
        if (workspace.status === 'loading') await workspace.restore();
        else await rescan();
    });

    // Catch up with the folder, unless a walk is already under way. Both callers
    // fire in bursts — a focus event can land on top of a mount — and a second
    // walk of the same tree would only repeat the first one's work.
    async function rescan() {
        if (workspace.status !== 'ready' || workspace.scanning) return;
        await workspace.refresh();
    }

    async function onCreate() {
        await doc.createNew();
        await goto('/edit');
    }

    async function onOpen(entry: DocumentIndexEntry) {
        await goto(`/edit?doc=${encodeURIComponent(documentPath(entry))}`);
    }

    async function onRename(entry: DocumentIndexEntry) {
        const next = window.prompt(
            m.files_rename_prompt({ title: entry.title }),
            entry.title
        );
        if (next === null) return;

        await doc.open(documentPath(entry));
        await doc.rename(next);
        await doc.close();
        await workspace.refresh();
    }

    // Removing something from the user's disk, with no trash to recover it from.
    function onDelete(entry: DocumentIndexEntry) {
        deleteTarget = entry;
        deleteOpen = true;
    }

    async function confirmDelete() {
        const entry = deleteTarget;
        if (!entry || !workspace.root) return;

        await deleteDocument(workspace.root, entry);
        await workspace.refresh();
    }

    async function confirmLeaveFolder() {
        // Flush before the handle is dropped. Reaching this screen normally means
        // the editor already closed the document, but a pending write must never
        // be outlived by the folder it was going to.
        await doc.close();
        await workspace.leaveFolder();
    }
</script>

<svelte:head>
    <title>{m.files_title()}</title>
</svelte:head>

<!-- Writing added, renamed or deleted in the file manager while this tab sat in
     the background is invisible until we look again. Coming back to the tab is
     the moment to do it. -->
<svelte:window onfocus={rescan} />

{#if workspace.status === 'unsupported'}
    <div class="mx-auto flex max-w-xl flex-1 items-center px-6">
        <EmptyState
            description={m.unsupported_description()}
            icon={FolderOpenIcon}
            title={m.unsupported_title()}
        />
    </div>
{:else if workspace.status === 'loading'}
    <div class="text-muted-foreground flex flex-1 items-center justify-center">
        <p>{m.welcome_loading()}</p>
    </div>
{:else if workspace.status === 'needs-folder' || workspace.status === 'needs-permission'}
    <div class="mx-auto flex max-w-2xl flex-1 items-center px-6">
        <!-- `pendingName` is empty in the first-run case, which is what picks
             the "start a new folder" card over "reopen". -->
        <Welcome.Root
            error={workspace.error}
            folderName={workspace.pendingName}
            onChoose={() => workspace.chooseFolder()}
            onReopen={() => workspace.reopen()}
            onSuggested={() =>
                workspace.chooseFolder({ subfolder: SUGGESTED_FOLDER_NAME })}
        />
    </div>
{:else}
    <div class="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <header class="flex items-center justify-between gap-4">
            <h1 class="text-xl font-semibold">{m.files_title()}</h1>
            <div class="flex items-center gap-2">
                <!-- The automatic rescans cover most of it; this is for the
                     writer who has just saved something from another app and
                     wants to see it now rather than wonder. -->
                <Button
                    disabled={workspace.scanning}
                    onclick={() => workspace.refresh()}
                    variant="ghost"
                >
                    <Icon icon={RefreshIcon} />
                    {m.files_refresh()}
                </Button>
                <Button onclick={() => (leaveOpen = true)} variant="ghost">
                    <Icon icon={FolderRemoveIcon} />
                    {m.files_leave()}
                </Button>
                <Button
                    onclick={() => workspace.chooseFolder()}
                    variant="ghost"
                >
                    <Icon icon={FolderOpenIcon} />
                    {m.files_change_folder()}
                </Button>
                <Button onclick={onCreate}>
                    <Icon icon={FileAddIcon} />
                    {m.files_new()}
                </Button>
            </div>
        </header>

        {#if workspace.error}
            <p class="text-destructive text-sm">{workspace.error}</p>
        {/if}

        <!-- Two different empty folders, and they must not read alike: one has
             nothing in it, the other is full of files this app cannot open. -->
        {#if workspace.isEmpty}
            <EmptyState
                description={workspace.hasUnopenableFiles
                    ? m.files_no_writing_description()
                    : m.files_empty_description()}
                icon={File01Icon}
                title={workspace.hasUnopenableFiles
                    ? m.files_no_writing_title()
                    : m.files_empty_title()}
            >
                {#snippet action()}
                    <Button onclick={onCreate}>
                        <Icon icon={FileAddIcon} />
                        {m.files_new()}
                    </Button>
                {/snippet}
            </EmptyState>
        {:else if workspace.tree}
            <FileTree.Root
                isExpanded={(node) => workspace.isExpanded(node)}
                node={workspace.tree}
                {onDelete}
                {onOpen}
                {onRename}
                onToggle={(node) => workspace.toggle(node)}
            />
        {/if}

        <!-- Both dialogs portal to <body>, so where they sit in the markup is
             immaterial; keeping them at the end of the branch that owns their
             state is just the easiest place to find them. -->
        <ConfirmDialog
            bind:open={deleteOpen}
            confirmLabel={m.files_delete()}
            description={deleteDescription}
            destructive
            onConfirm={confirmDelete}
            title={m.files_delete_title({ title: deleteTarget?.title ?? '' })}
        />

        <!-- Not destructive: nothing on disk is touched. The only cost of a
             mistake is another trip through the picker. -->
        <ConfirmDialog
            bind:open={leaveOpen}
            confirmLabel={m.files_leave()}
            description={m.files_leave_description()}
            onConfirm={confirmLeaveFolder}
            title={m.files_leave_title({ name: workspace.root?.name ?? '' })}
        />
    </div>
{/if}
