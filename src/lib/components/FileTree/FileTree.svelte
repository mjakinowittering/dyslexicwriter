<script lang="ts">
    import {
        ArrowDown01Icon,
        ArrowRight01Icon,
        Delete02Icon,
        FileAddIcon,
        Folder01Icon,
        FolderAddIcon
    } from '@hugeicons/core-free-icons';
    import { prefersReducedMotion } from 'svelte/motion';
    import { slide } from 'svelte/transition';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

    import { disclosureDuration, motionEasing } from '$lib/config/motion';
    import type { FolderNode } from '$lib/fs';
    import { documentPath } from '$lib/models/document.model';
    import * as m from '$lib/paraglide/messages';

    import type { FileTreeActions, FileTreeNaming } from './actions';
    import FileTree from './FileTree.svelte';
    import FileTreeDocument from './FileTreeDocument.svelte';
    import FileTreeNameRow from './FileTreeNameRow.svelte';
    import FileTreeRowMenu from './FileTreeRowMenu.svelte';

    // The working folder as the user actually keeps it: folders that hold
    // writing, and the markdown files inside them. Recursive — each folder row
    // renders another one of these below itself.
    //
    // This is a disclosure list rather than an ARIA tree widget: a `<button
    // aria-expanded>` owning the list nested beside it in the same `<li>`. Tab
    // reaches every row, Enter and Space open a folder, and no roving-tabindex
    // machinery stands between the writer and their documents.
    //
    // Expansion state and the open naming row both live outside the component so
    // the whole tree can be driven from one place (and a story can drive it from
    // nothing). There is only ever one naming row open, which is not something a
    // recursive component has any level at which to own.
    let {
        node,
        isExpanded,
        onToggle,
        actions,
        naming = null,
        onNamingSubmit,
        onNamingCancel
    }: {
        node: FolderNode;
        isExpanded: (node: FolderNode) => boolean;
        onToggle: (node: FolderNode) => void;
        actions: FileTreeActions;
        naming?: FileTreeNaming | null;
        onNamingSubmit: (name: string) => void;
        onNamingCancel: () => void;
    } = $props();

    const reveal = $derived({
        duration: prefersReducedMotion.current ? 0 : disclosureDuration,
        easing: motionEasing
    });

    // The naming row belongs to exactly one directory in the tree, and this
    // component is rendered once per directory.
    const namingHere = $derived(naming?.parent === node.path ? naming : null);

    // Nothing to draw below this folder, so the disclosure says so rather than
    // opening onto a blank gap. True of a folder the depth cap stopped at as
    // well: it has nothing to show *yet*, which looks the same from here.
    function showsNothing(folder: FolderNode): boolean {
        return folder.folders.length === 0 && folder.documents.length === 0;
    }

    // Delete is offered only for a folder we have looked inside and found
    // nothing in — a stricter question than the one above, and it turns on the
    // `loaded` the two differ by. An unloaded folder has not been looked at, so
    // offering to delete it would be a guess; removeEntry without `recursive`
    // would refuse it anyway.
    function isEmptyFolder(folder: FolderNode): boolean {
        return folder.loaded && showsNothing(folder);
    }
</script>

<ul class="flex flex-col">
    {#if namingHere}
        <FileTreeNameRow
            kind={namingHere.kind}
            onCancel={onNamingCancel}
            onSubmit={onNamingSubmit}
            takenDocuments={namingHere.kind === 'document'
                ? node.documents.map((entry) => entry.title)
                : // A folder-document is a real directory of that name on disk,
                  // so it blocks a folder. A file-document is `One.md` and never
                  // did.
                  node.documents
                      .filter((entry) => entry.ownsFolder)
                      .map((entry) => entry.title)}
            takenFolders={node.folders.map((folder) => folder.name)}
        />
    {/if}

    {#each node.folders as folder (folder.path)}
        {@const open = isExpanded(folder)}
        <li>
            <!-- The whole row is the hover surface, the menu beside the title
                 included, so it reads as one thing rather than two controls that
                 happen to be adjacent. `focus-within` matches it for a keyboard,
                 and the ring is what carries the affordance — the fill alone had
                 to be loud to be seen. -->
            <div
                class="group/row hover:bg-muted/40 hover:ring-border focus-within:bg-muted/40 focus-within:ring-border flex items-center gap-2 rounded-md px-2 ring-1 ring-transparent"
            >
                <button
                    aria-expanded={open}
                    class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 pr-2 pl-0 text-left"
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

                <FileTreeRowMenu
                    label={m.files_folder_menu({ name: folder.name })}
                >
                    <DropdownMenu.Item
                        onSelect={() => actions.newDocument(folder)}
                    >
                        <Icon icon={FileAddIcon} />
                        {m.files_new()}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        onSelect={() => actions.newFolder(folder)}
                    >
                        <Icon icon={FolderAddIcon} />
                        {m.files_new_folder()}
                    </DropdownMenu.Item>
                    {#if isEmptyFolder(folder)}
                        <DropdownMenu.Item
                            onSelect={() => actions.deleteFolder(folder)}
                        >
                            <Icon icon={Delete02Icon} />
                            {m.files_folder_delete()}
                        </DropdownMenu.Item>
                    {/if}
                </FileTreeRowMenu>
            </div>

            {#if open}
                <!-- One icon column of indent: 20px to put the guide line down
                     the centre of this row's chevron (which spans 8–32), 1px of
                     border, then 11px — 32px in all. A child row's own p-2 then
                     starts its first icon at 40, exactly where this row's FOLDER
                     icon starts, so a subfolder's chevron and a document's file
                     icon both sit under the folder they belong to. Documents get
                     no extra spacer; that is what keeps them in the parent's
                     column rather than beside their siblings'. -->
                <div
                    class="border-border ms-5 border-s ps-2.75"
                    transition:slide={reveal}
                >
                    <!-- Two different empty folders, the same distinction the
                         Files screen draws at the root: one has nothing in it,
                         the other holds files this app cannot open. Saying
                         "nothing in here" about somebody's work reads as if the
                         app threw it away. -->
                    {#if showsNothing(folder) && naming?.parent !== folder.path}
                        <p class="text-muted-foreground p-2 text-sm">
                            {folder.hasOtherEntries
                                ? m.files_folder_no_writing()
                                : m.files_folder_empty()}
                        </p>
                    {:else}
                        <FileTree
                            {actions}
                            {isExpanded}
                            {naming}
                            node={folder}
                            {onNamingCancel}
                            {onNamingSubmit}
                            {onToggle}
                        />
                    {/if}
                </div>
            {/if}
        </li>
    {/each}

    {#each node.documents as entry (documentPath(entry))}
        <FileTreeDocument {actions} {entry} />
    {/each}
</ul>
