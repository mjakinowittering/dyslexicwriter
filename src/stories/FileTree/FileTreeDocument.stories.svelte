<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import FileTreeDocument from '$lib/components/FileTree/FileTreeDocument.svelte';

    const { Story } = defineMeta({
        title: 'FileTree/FileTreeDocument',
        component: FileTreeDocument,
        tags: ['autodocs'],
        argTypes: {
            entry: { control: false },
            onOpen: { control: false },
            onRename: { control: false },
            onDelete: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'One document row in the Files tree: the title and when it was last edited, with rename and delete beside them. The whole title block opens the document.'
                }
            }
        }
    });

    const handlers = { onOpen: fn(), onRename: fn(), onDelete: fn() };

    const entry = {
        title: 'My Chapter',
        folder: 'My Chapter',
        file: 'My Chapter.md',
        ownsFolder: true,
        lastModified: Date.now() - 3_600_000
    };
</script>

<Story
    name="Default"
    args={{ entry, ...handlers }}
    play={async ({ canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', { name: /My Chapter/ })
        );
        await expect(handlers.onOpen).toHaveBeenCalledWith(entry);
    }}
>
    {#snippet template(args)}
        <ul class="bg-background w-full max-w-2xl p-6">
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
            lastModified: Date.now() - 86_400_000
        },
        ...handlers
    }}
    play={async ({ canvas }) => {
        // A markdown file the app found rather than created reads exactly the
        // same; what differs is what rename and delete do to it.
        await expect(canvas.getByText('notes')).toBeInTheDocument();
        await expect(
            canvas.getByRole('button', { name: 'Delete' })
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <ul class="bg-background w-full max-w-2xl p-6">
            <FileTreeDocument {...args} />
        </ul>
    {/snippet}
</Story>
