<script lang="ts">
    import {
        File01Icon,
        FileAddIcon,
        FolderOpenIcon
    } from '@hugeicons/core-free-icons';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    import * as AppHeader from '$lib/components/AppHeader';
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
    import type { DocumentIndexEntry } from '$lib/models/config.model';
    import { documentPath } from '$lib/models/document.model';
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
        if (workspace.status === 'loading') await workspace.restore();
    });

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

<!-- The app chrome, above every state of this route. The mark is there from the
     first paint; the theme toggle and the menu wait for a folder, because a
     theme has nowhere to save to without one and both menu actions are about
     the folder itself. -->
<AppHeader.Root
    hasFolder={workspace.status === 'ready'}
    onChangeFolder={() => workspace.chooseFolder()}
    onLeaveFolder={() => (leaveOpen = true)}
/>

<!-- Sits with the header rather than inside the branch below, so the control
     that opens it and the dialog itself aren't split across the {#if}. Not
     destructive: nothing on disk is touched. The only cost of a mistake is
     another trip through the picker. -->
<ConfirmDialog
    bind:open={leaveOpen}
    confirmLabel={m.files_leave()}
    description={m.files_leave_description()}
    onConfirm={confirmLeaveFolder}
    title={m.files_leave_title({ name: workspace.root?.name ?? '' })}
/>

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
        <!-- The list's own title row, not a landmark: the folder actions that
             used to sit here have moved up into the app header's menu, and the
             page's one <header> is that. -->
        <div class="flex items-center justify-between gap-4">
            <h1 class="text-xl font-semibold">{m.files_title()}</h1>
            <Button onclick={onCreate}>
                <Icon icon={FileAddIcon} />
                {m.files_new()}
            </Button>
        </div>

        {#if workspace.error}
            <p class="text-destructive text-sm">{workspace.error}</p>
        {/if}

        {#if workspace.documents.length === 0}
            <EmptyState
                description={m.files_empty_description()}
                icon={File01Icon}
                title={m.files_empty_title()}
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

        <!-- Portals to <body>, so where it sits in the markup is immaterial;
             keeping it at the end of the branch that owns the list it deletes
             from is just the easiest place to find it. -->
        <ConfirmDialog
            bind:open={deleteOpen}
            confirmLabel={m.files_delete()}
            description={deleteDescription}
            destructive
            onConfirm={confirmDelete}
            title={m.files_delete_title({ title: deleteTarget?.title ?? '' })}
        />
    </div>
{/if}
