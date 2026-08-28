<script lang="ts">
    import {
        File01Icon,
        FileAddIcon,
        FolderOpenIcon
    } from '@hugeicons/core-free-icons';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

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

    async function onDelete(entry: DocumentIndexEntry) {
        // Removing something from the user's disk, with no trash to recover it
        // from — always confirm, and be honest about which it is: a document that
        // owns its folder takes the folder and its images with it, a markdown
        // file sitting among the user's other files takes only itself.
        const confirmed = window.confirm(
            entry.ownsFolder
                ? m.files_delete_confirm({ title: entry.title })
                : m.files_delete_file_confirm({ title: entry.title })
        );
        if (!confirmed) return;
        if (!workspace.root) return;

        await deleteDocument(workspace.root, entry);
        await workspace.refresh();
    }
</script>

<svelte:head>
    <title>{m.files_title()}</title>
</svelte:head>

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
    </div>
{/if}
