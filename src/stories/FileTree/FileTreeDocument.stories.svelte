<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

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
                        'One document row in the Files tree: the title and when it was last edited, with rename and delete in the row menu. The whole title block opens the document.'
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
        lastModified: Date.now() - 3_600_000
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
        <ul class="bg-background w-full max-w-2xl p-6">
            <FileTreeDocument {...args} />
        </ul>
    {/snippet}
</Story>
