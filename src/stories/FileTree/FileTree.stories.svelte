<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';
    import { SvelteSet } from 'svelte/reactivity';

    import FileTree from '$lib/components/FileTree/FileTree.svelte';

    import type { FolderNode } from '$lib/fs';
    import type { DocumentIndexEntry } from '$lib/models/config.model';

    const { Story } = defineMeta({
        title: 'FileTree/FileTree',
        component: FileTree,
        tags: ['autodocs'],
        argTypes: {
            node: { control: false },
            isExpanded: { control: false },
            onToggle: { control: false },
            onOpen: { control: false },
            onRename: { control: false },
            onDelete: { control: false }
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

    const handlers = {
        onOpen: fn(),
        onRename: fn(),
        onDelete: fn(),
        onToggle: fn()
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

        // A folder the scan never reached announces itself as closed.
        await expect(
            canvas.getByRole('button', { name: /Archive/ })
        ).toHaveAttribute('aria-expanded', 'false');
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

        await userEvent.click(canvas.getByRole('button', { name: /Book/ }));
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
        await userEvent.click(canvas.getByRole('button', { name: /Archive/ }));
        // An expanded folder with nothing in it says so rather than showing a
        // blank gap.
        await expect(canvas.getByText('Nothing in here')).toBeInTheDocument();
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
