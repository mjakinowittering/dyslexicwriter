<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent, waitFor } from 'storybook/test';

    import type { FileTreeActions } from '$lib/components/FileTree';
    import FileTreeDocument from '$lib/components/FileTree/FileTreeDocument.svelte';

    const { Story } = defineMeta({
        title: 'FileTree/FileTreeDocument',
        component: FileTreeDocument,
        tags: ['autodocs'],
        argTypes: {
            entry: { control: false },
            actions: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'One document row in the Files tree: the title, when it was last edited and its size, with rename and delete in the row menu. The whole title block opens the document. Shown on the panel the Files screen draws the tree on.'
                }
            }
        }
    });

    const actions: FileTreeActions = {
        open: fn(),
        rename: fn(),
        delete: fn(),
        newDocument: fn(),
        newFolder: fn(),
        deleteFolder: fn()
    };

    const entry = {
        title: 'My Chapter',
        folder: 'My Chapter',
        file: 'My Chapter.md',
        ownsFolder: true,
        lastModified: Date.now() - 3_600_000,
        size: 4_000
    };
</script>

<Story
    name="Default"
    args={{ entry, actions }}
    play={async ({ canvas }) => {
        // Matched exactly: the row's menu button names the document too.
        await userEvent.click(
            canvas.getByRole('button', { name: /^My Chapter/ })
        );
        await expect(actions.open).toHaveBeenCalledWith(entry);
    }}
>
    {#snippet template(args)}
        <ul class="bg-panel w-full max-w-2xl rounded-2xl border p-3">
            <FileTreeDocument {...args} />
        </ul>
    {/snippet}
</Story>

<!-- A file with nothing in it says so, rather than "0 KB" or a rounded-up "1 KB". -->
<Story
    name="Empty File"
    args={{ entry: { ...entry, size: 0 }, actions }}
    play={async ({ canvas }) => {
        await expect(canvas.getByText(/· Empty$/)).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <ul class="bg-panel w-full max-w-2xl rounded-2xl border p-3">
            <FileTreeDocument {...args} />
        </ul>
    {/snippet}
</Story>

<Story
    name="Loose File"
    args={{
        entry: {
            title: 'notes',
            folder: '',
            file: 'notes.md',
            ownsFolder: false,
            lastModified: Date.now() - 86_400_000,
            size: 312_000
        },
        actions
    }}
    play={async ({ canvas }) => {
        // A markdown file the app found rather than created reads exactly the
        // same; what differs is what rename and delete do to it.
        await expect(canvas.getByText('notes')).toBeInTheDocument();
        await expect(
            canvas.getByRole('button', { name: 'Actions for "notes"' })
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <ul class="bg-panel w-full max-w-2xl rounded-2xl border p-3">
            <FileTreeDocument {...args} />
        </ul>
    {/snippet}
</Story>

<!-- Where the editor's "Show in Files" lands: the highlighter wash and its
     ring, a heavier title and a darker "Edited" line, and focus on the row so
     Enter reopens it. The play waits for the focus, so the axe run that follows
     measures the text against the wash while it is still held. -->
<Story
    name="Arriving"
    args={{
        entry: {
            title: 'The Lantern Room',
            folder: 'Chapters/The Lantern Room',
            file: 'The Lantern Room.md',
            ownsFolder: true,
            lastModified: Date.now() - 60_000,
            size: 4_000
        },
        actions,
        arriving: true
    }}
    play={async ({ canvas, canvasElement }) => {
        await waitFor(() =>
            expect(
                canvas.getByRole('button', { name: /^The Lantern Room Edited/ })
            ).toHaveFocus()
        );
        await expect(
            canvasElement.querySelector('[data-arrival]')
        ).not.toBeNull();
    }}
>
    {#snippet template(args)}
        <ul class="bg-panel w-full max-w-2xl rounded-2xl border p-3">
            <FileTreeDocument {...args} />
        </ul>
    {/snippet}
</Story>
