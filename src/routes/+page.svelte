<script lang="ts">
    import {
        Delete02Icon,
        File01Icon,
        FileAddIcon,
        FolderOpenIcon,
        PencilEdit01Icon
    } from '@hugeicons/core-free-icons';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';

    import { deleteDocument, isFileSystemAccessSupported } from '$lib/fs';
    import type { DocumentIndexEntry } from '$lib/models/config.model';
    import * as m from '$lib/paraglide/messages';
    import { doc } from '$lib/stores/document.svelte';
    import { workspace } from '$lib/stores/workspace.svelte';
    import { relativeTime } from '$lib/utils/relative-time';

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
        await goto(`/edit?doc=${encodeURIComponent(entry.folder)}`);
    }

    async function onRename(entry: DocumentIndexEntry) {
        const next = window.prompt(
            m.files_rename_prompt({ title: entry.title }),
            entry.title
        );
        if (next === null) return;

        await doc.open(entry.folder);
        await doc.rename(next);
        await doc.close();
        await workspace.refresh();
    }

    async function onDelete(entry: DocumentIndexEntry) {
        // Removing a real folder from the user's disk, with no trash to recover
        // it from — always confirm, and say exactly what goes.
        if (!window.confirm(m.files_delete_confirm({ title: entry.title }))) {
            return;
        }
        if (!workspace.root) return;

        await deleteDocument(workspace.root, entry.folder);
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
{:else if workspace.status === 'needs-folder'}
    <div class="mx-auto flex max-w-xl flex-1 items-center px-6">
        <EmptyState
            description={m.welcome_description()}
            icon={FolderOpenIcon}
            title={m.welcome_title()}
        >
            {#snippet action()}
                <div class="flex flex-col items-center gap-3">
                    <Button onclick={() => workspace.chooseFolder()}>
                        <Icon icon={FolderOpenIcon} />
                        {m.welcome_choose_folder()}
                    </Button>
                    <!-- The browser blocks Downloads, the home folder and system
                         folders outright. Say so before the picker does, so the
                         refusal doesn't read as the app being broken. -->
                    <p
                        class="text-muted-foreground max-w-sm text-center text-xs"
                    >
                        {m.welcome_folder_hint()}
                    </p>
                    {#if workspace.error}
                        <p
                            class="text-destructive max-w-sm text-center text-sm"
                        >
                            {workspace.error}
                        </p>
                    {/if}
                </div>
            {/snippet}
        </EmptyState>
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
        {:else}
            <ul class="divide-border divide-y">
                {#each workspace.documents as entry (entry.folder)}
                    <li class="flex items-center gap-3 py-3">
                        <button
                            class="flex min-w-0 flex-1 flex-col items-start text-left"
                            onclick={() => onOpen(entry)}
                            type="button"
                        >
                            <span class="w-full truncate font-medium">
                                {entry.title}
                            </span>
                            <span class="text-muted-foreground text-sm">
                                {m.files_modified({
                                    when: relativeTime(entry.lastModified)
                                })}
                            </span>
                        </button>

                        <Button
                            aria-label={m.files_rename()}
                            onclick={() => onRename(entry)}
                            size="icon"
                            variant="ghost"
                        >
                            <Icon icon={PencilEdit01Icon} />
                        </Button>
                        <Button
                            aria-label={m.files_delete()}
                            onclick={() => onDelete(entry)}
                            size="icon"
                            variant="ghost"
                        >
                            <Icon icon={Delete02Icon} />
                        </Button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
{/if}
