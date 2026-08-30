<script lang="ts">
    import {
        ArrowDown01Icon,
        File01Icon,
        FileAddIcon,
        FolderAddIcon,
        FolderOpenIcon,
        RefreshIcon
    } from '@hugeicons/core-free-icons';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    import * as AppHeader from '$lib/components/AppHeader';
    import ConfirmDialog from '$lib/components/ConfirmDialog/ConfirmDialog.svelte';
    import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
    import * as FileTree from '$lib/components/FileTree';
    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as ButtonGroup from '$lib/components/ui/button-group';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import * as Welcome from '$lib/components/Welcome';

    import {
        createDocument,
        createFolder,
        deleteDocument,
        deleteFolder,
        DocumentError,
        isFileSystemAccessSupported,
        SUGGESTED_FOLDER_NAME,
        type FolderNode
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
    let folderDeleteOpen = $state(false);
    let folderDeleteTarget = $state<FolderNode | null>(null);

    // The one inline naming row the tree may have open, owned here rather than
    // inside the recursive tree component — there is only ever one, and opening
    // a second would leave the first stranded mid-name.
    let naming = $state<FileTree.FileTreeNaming | null>(null);

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

    // Open the naming row inside a folder, expanding it first so the row is
    // actually visible. For a folder the depth cap stopped at, `toggle` is also
    // what goes and looks — and the duplicate check the row runs is only worth
    // anything once we know what is in there.
    async function startNaming(node: FolderNode, kind: 'folder' | 'document') {
        workspace.error = '';
        if (!workspace.isExpanded(node)) await workspace.toggle(node);
        naming = { parent: node.path, kind };
    }

    // "New folder" in the title row: the same row, at the top level.
    function onNewFolderAtRoot() {
        workspace.error = '';
        naming = { parent: '', kind: 'folder' };
    }

    async function onNamingSubmit(name: string) {
        const target = naming;
        const root = workspace.root;
        if (!target || !root) return;

        naming = null;

        try {
            if (target.kind === 'folder') {
                await createFolder(root, target.parent, name);
            } else {
                // Deliberately no goto: the writer has already typed the name,
                // and is more often than not setting up structure — a folder and
                // three chapters in it — rather than about to start writing.
                await createDocument(root, target.parent, name);
            }
        } catch (cause) {
            // Thrown from a handler nobody awaits, so it has to land somewhere
            // the writer can see it rather than in an unhandled rejection.
            workspace.error =
                cause instanceof DocumentError
                    ? cause.message
                    : m.files_read_error();
            return;
        }

        await workspace.refresh();
    }

    // Only ever offered for a folder the scan found empty. The browser is what
    // actually enforces that — removeEntry without `recursive` refuses a
    // directory with anything in it — so a folder filled behind our back between
    // the scan and the confirm fails safely rather than taking writing with it.
    function onDeleteFolder(node: FolderNode) {
        folderDeleteTarget = node;
        folderDeleteOpen = true;
    }

    async function confirmDeleteFolder() {
        const node = folderDeleteTarget;
        if (!node || !workspace.root) return;

        try {
            await deleteFolder(workspace.root, node.path);
        } catch (cause) {
            workspace.error =
                cause instanceof DocumentError
                    ? cause.message
                    : m.files_read_error();
            return;
        }

        await workspace.refresh();
    }

    const treeActions: FileTree.FileTreeActions = {
        open: onOpen,
        rename: onRename,
        delete: onDelete,
        newDocument: (node) => startNaming(node, 'document'),
        newFolder: (node) => startNaming(node, 'folder'),
        deleteFolder: onDeleteFolder
    };

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
        <!-- The list's own title row, not a landmark: the two folder actions
             that used to sit here have moved up into the app header's menu, and
             the page's one <header> is that.

             One control rather than three. "New document" is the screen's only
             primary action, so Refresh and "New folder" ride behind it as a
             split button instead of standing beside it as two more buttons
             competing for the same corner. -->
        <div class="flex items-center justify-between gap-4">
            <h1 class="text-xl font-semibold">{m.files_title()}</h1>
            <ButtonGroup.Root>
                <Button onclick={onCreate}>
                    <Icon icon={FileAddIcon} />
                    {m.files_new()}
                </Button>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                        {#snippet child({ props })}
                            <Button
                                {...props}
                                aria-label={m.files_more_actions()}
                            >
                                <Icon icon={ArrowDown01Icon} />
                            </Button>
                        {/snippet}
                    </DropdownMenu.Trigger>
                    <!-- w-auto because nova pins menu content to its anchor's
                         width, and this anchor is a bare chevron button. -->
                    <DropdownMenu.Content align="end" class="w-auto">
                        <!-- The automatic rescans cover most of it; this is for
                             the writer who has just saved something from another
                             app and wants to see it now rather than wonder. -->
                        <DropdownMenu.Item
                            disabled={workspace.scanning}
                            onSelect={() => workspace.refresh()}
                        >
                            <Icon icon={RefreshIcon} />
                            {m.files_refresh()}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onSelect={onNewFolderAtRoot}>
                            <Icon icon={FolderAddIcon} />
                            {m.files_new_folder()}
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </ButtonGroup.Root>
        </div>

        {#if workspace.error}
            <p class="text-destructive text-sm">{workspace.error}</p>
        {/if}

        <!-- Two different empty folders, and they must not read alike: one has
             nothing in it, the other is full of files this app cannot open.
             `naming` beats both: the tree is where the naming row is drawn, so
             an empty folder still has to render one to name the first thing
             into it. -->
        {#if workspace.isEmpty && !naming}
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
                actions={treeActions}
                isExpanded={(node) => workspace.isExpanded(node)}
                {naming}
                node={workspace.tree}
                onNamingCancel={() => (naming = null)}
                {onNamingSubmit}
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

        <!-- Only ever an empty folder, so nothing of the user's is in it — but
             it is still a directory leaving their disk with no trash behind it,
             and CLAUDE.md asks before any of those. -->
        <ConfirmDialog
            bind:open={folderDeleteOpen}
            confirmLabel={m.files_delete()}
            description={m.files_folder_delete_description()}
            destructive
            onConfirm={confirmDeleteFolder}
            title={m.files_folder_delete_title({
                name: folderDeleteTarget?.name ?? ''
            })}
        />
    </div>
{/if}
