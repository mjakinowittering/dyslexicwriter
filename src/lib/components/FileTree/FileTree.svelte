<script lang="ts">
    import {
        ArrowDown01Icon,
        ArrowRight01Icon,
        Folder01Icon
    } from '@hugeicons/core-free-icons';
    import { prefersReducedMotion } from 'svelte/motion';
    import { slide } from 'svelte/transition';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import { disclosureDuration, motionEasing } from '$lib/config/motion';
    import type { FolderNode } from '$lib/fs';
    import type { DocumentIndexEntry } from '$lib/models/config.model';
    import { documentPath } from '$lib/models/document.model';
    import * as m from '$lib/paraglide/messages';

    import FileTree from './FileTree.svelte';
    import FileTreeDocument from './FileTreeDocument.svelte';

    // The working folder as the user actually keeps it: folders that hold
    // writing, and the markdown files inside them. Recursive — each folder row
    // renders another one of these below itself.
    //
    // This is a disclosure list rather than an ARIA tree widget: a `<button
    // aria-expanded>` owning the list nested beside it in the same `<li>`. Tab
    // reaches every row, Enter and Space open a folder, and no roving-tabindex
    // machinery stands between the writer and their documents.
    //
    // Expansion state lives outside the component so the whole tree can be driven
    // from one place (and a story can drive it from nothing).
    let {
        node,
        isExpanded,
        onToggle,
        onOpen,
        onRename,
        onDelete
    }: {
        node: FolderNode;
        isExpanded: (node: FolderNode) => boolean;
        onToggle: (node: FolderNode) => void;
        onOpen: (entry: DocumentIndexEntry) => void;
        onRename: (entry: DocumentIndexEntry) => void;
        onDelete: (entry: DocumentIndexEntry) => void;
    } = $props();

    const reveal = $derived({
        duration: prefersReducedMotion.current ? 0 : disclosureDuration,
        easing: motionEasing
    });
</script>

<ul class="flex flex-col">
    {#each node.folders as folder (folder.path)}
        {@const open = isExpanded(folder)}
        <li>
            <button
                aria-expanded={open}
                class="hover:bg-muted/60 flex w-full min-w-0 items-center gap-2 rounded-md p-2 text-left"
                onclick={() => onToggle(folder)}
                type="button"
            >
                <Icon
                    class="text-muted-foreground shrink-0"
                    icon={open ? ArrowDown01Icon : ArrowRight01Icon}
                />
                <Icon
                    class="text-muted-foreground shrink-0"
                    icon={Folder01Icon}
                />
                <span class="truncate font-medium">{folder.name}</span>
            </button>

            {#if open}
                <div
                    class="border-border ms-4 border-s ps-2"
                    transition:slide={reveal}
                >
                    {#if folder.folders.length === 0 && folder.documents.length === 0}
                        <p class="text-muted-foreground p-2 text-sm">
                            {m.files_folder_empty()}
                        </p>
                    {:else}
                        <FileTree
                            node={folder}
                            {isExpanded}
                            {onDelete}
                            {onOpen}
                            {onRename}
                            {onToggle}
                        />
                    {/if}
                </div>
            {/if}
        </li>
    {/each}

    {#each node.documents as entry (documentPath(entry))}
        <FileTreeDocument {entry} {onDelete} {onOpen} {onRename} />
    {/each}
</ul>
