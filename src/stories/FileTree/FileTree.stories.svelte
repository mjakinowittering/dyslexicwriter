<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent, waitFor } from 'storybook/test';
    import { SvelteSet } from 'svelte/reactivity';

    import type { FileTreeActions } from '$lib/components/FileTree';
    import FileTree from '$lib/components/FileTree/FileTree.svelte';

    import type { FolderNode } from '$lib/fs';
    import type { DocumentIndexEntry } from '$lib/models/document.model';

    const { Story } = defineMeta({
        title: 'FileTree/FileTree',
        component: FileTree,
        tags: ['autodocs'],
        argTypes: {
            node: { control: false },
            isExpanded: { control: false },
            onToggle: { control: false },
            actions: { control: false },
            naming: { control: false },
            onNamingSubmit: { control: false },
            onNamingCancel: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The Files screen tree. A disclosure list: each folder row is a `<button aria-expanded>` owning the list nested beside it. Expansion state is owned by the caller, so a folder the scan never reached can load its contents when it opens.'
                }
            }
        }
    });

    const DAY = 86_400_000;

    function doc(
        title: string,
        folder: string,
        ownsFolder = false
    ): DocumentIndexEntry {
        return {
            title,
            folder,
            file: `${title}.md`,
            ownsFolder,
            lastModified: Date.now() - DAY
        };
    }

    function folder(
        name: string,
        path: string,
        contents: Partial<FolderNode> = {}
    ): FolderNode {
        return {
            name,
            path,
            folders: [],
            documents: [],
            loaded: true,
            hasOtherEntries: false,
            ...contents
        };
    }

    // A working folder as a writer actually keeps it: the app's own
    // one-folder-per-document shape, a nested book, and a loose note at the root.
    //
    // `My Chapter` sits at the root beside `notes` even though it lives in a
    // folder of its own on disk — the scan collapses a folder holding nothing
    // but one document into that document, so there is no row here to open.
    const tree: FolderNode = folder('Writing', '', {
        folders: [
            folder('Book', 'Book', {
                folders: [
                    folder('Chapters', 'Book/Chapters', {
                        documents: [
                            doc('One', 'Book/Chapters'),
                            doc('Two', 'Book/Chapters')
                        ]
                    })
                ]
            }),
            // Past the depth cap: known to exist, contents not yet scanned.
            folder('Archive', 'Archive', { loaded: false })
        ],
        documents: [doc('My Chapter', 'My Chapter', true), doc('notes', '')]
    });

    const actions: FileTreeActions = {
        open: fn(),
        rename: fn(),
        delete: fn(),
        newDocument: fn(),
        newFolder: fn(),
        deleteFolder: fn()
    };

    const handlers = {
        actions,
        onToggle: fn(),
        onNamingSubmit: fn(),
        onNamingCancel: fn()
    };
</script>

<Story
    name="Default"
    args={{
        node: tree,
        isExpanded: (node: FolderNode) => node.loaded,
        ...handlers
    }}
    play={async ({ canvas }) => {
        // The loose file at the root and the nested chapters are all reachable.
        await expect(canvas.getByText('notes')).toBeInTheDocument();
        await expect(canvas.getByText('One')).toBeInTheDocument();

        // A document that owns its folder is a row of its own, not a folder to
        // open — there is no disclosure button carrying its name.
        await expect(canvas.getByText('My Chapter')).toBeInTheDocument();
        await expect(
            canvas.queryByRole('button', { name: /^My Chapter$/ })
        ).not.toBeInTheDocument();

        // A folder the scan never reached announces itself as closed. Matched
        // exactly: every folder row also carries a menu button naming it.
        await expect(
            canvas.getByRole('button', { name: /^Archive$/ })
        ).toHaveAttribute('aria-expanded', 'false');

        // Both kinds of row hang their actions off the same overflow menu.
        await expect(
            canvas.getByRole('button', { name: 'Actions for "Archive"' })
        ).toBeInTheDocument();
        await expect(
            canvas.getByRole('button', { name: 'Actions for "notes"' })
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full max-w-3xl p-6">
            <FileTree {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Collapsed"
    args={{ node: tree, isExpanded: () => false, ...handlers }}
    play={async ({ canvas }) => {
        // Nothing below a closed folder is in the DOM at all.
        await expect(canvas.queryByText('One')).not.toBeInTheDocument();

        await userEvent.click(canvas.getByRole('button', { name: /^Book$/ }));
        await expect(handlers.onToggle).toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full max-w-3xl p-6">
            <FileTree {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Interactive"
    args={{ node: tree, ...handlers }}
    play={async ({ canvas }) => {
        // An expanded folder with nothing in it says so rather than showing a
        // blank gap.
        await expect(canvas.getByText('Nothing in here')).toBeInTheDocument();

        // Driven by the story's own state, a folder shuts and opens again.
        const archive = canvas.getByRole('button', { name: /^Archive$/ });
        await userEvent.click(archive);
        await expect(archive).toHaveAttribute('aria-expanded', 'false');
        await userEvent.click(archive);
        await expect(archive).toHaveAttribute('aria-expanded', 'true');
    }}
>
    {#snippet template(args)}
        {@const collapsed = new SvelteSet<string>()}
        <div class="bg-background w-full max-w-3xl p-6">
            <FileTree
                {...args}
                isExpanded={(node) => !collapsed.has(node.path)}
                onToggle={(node) => {
                    if (collapsed.has(node.path)) collapsed.delete(node.path);
                    else collapsed.add(node.path);
                }}
            />
        </div>
    {/snippet}
</Story>

<!-- The tree indents by exactly one icon column per level, so every row's first
     icon sits under the folder icon of the folder holding it. Worth a story of
     its own: it is the kind of thing that drifts a few pixels at a time and is
     only ever obvious side by side. -->
<Story
    name="Alignment"
    args={{
        node: folder('Writing', '', {
            folders: [
                folder('Book', 'Book', {
                    folders: [
                        folder('Chapters', 'Book/Chapters', {
                            documents: [doc('One', 'Book/Chapters')]
                        })
                    ],
                    documents: [doc('Outline', 'Book')]
                })
            ],
            documents: [doc('notes', '')]
        }),
        isExpanded: () => true,
        ...handlers
    }}
    play={async ({ canvas }) => {
        // Every level is open, so all four rows are on screen at once.
        await expect(canvas.getByText('Chapters')).toBeInTheDocument();
        await expect(canvas.getByText('One')).toBeInTheDocument();
        await expect(canvas.getByText('Outline')).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full max-w-3xl p-6">
            <FileTree {...args} />
        </div>
    {/snippet}
</Story>

<!-- The row menu is revealed by hover OR by focus, and only the second can be
     tested here: `userEvent.hover` dispatches pointer events but never moves a
     real pointer, so CSS :hover does not engage. Focus does, and it is the path
     that matters most anyway — a control a keyboard cannot reach is a control
     that is not there. The hover rule mirrors this one exactly. -->
<Story
    name="Revealed On Focus"
    args={{ node: tree, isExpanded: () => true, ...handlers }}
    play={async ({ canvas }) => {
        const menu = canvas.getByRole('button', {
            name: 'Actions for "notes"'
        });

        // Drawn but transparent to begin with. It keeps its place in the layout
        // so the row never changes width, and stays in the accessibility tree so
        // it can be tabbed to at all.
        await expect(getComputedStyle(menu).opacity).toBe('0');

        menu.focus();
        await waitFor(() => expect(getComputedStyle(menu).opacity).toBe('1'));
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full max-w-3xl p-6">
            <FileTree {...args} />
        </div>
    {/snippet}
</Story>
