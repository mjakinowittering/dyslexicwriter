<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import FileTreeNameRow from '$lib/components/FileTree/FileTreeNameRow.svelte';

    const { Story } = defineMeta({
        title: 'FileTree/FileTreeNameRow',
        component: FileTreeNameRow,
        tags: ['autodocs'],
        argTypes: {
            kind: { control: false },
            taken: { control: false },
            onSubmit: { control: false },
            onCancel: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Naming a folder or a document as it is made, inline in the tree at the depth the thing will live at. Create is out of reach while the field is blank or the name is already taken; `.md` sits in an addon for a document, because the title *is* the filename.'
                }
            }
        }
    });

    const handlers = { onSubmit: fn(), onCancel: fn() };
</script>

<Story
    name="Folder"
    args={{ kind: 'folder', taken: ['Chapters'], ...handlers }}
    play={async ({ canvas }) => {
        const field = canvas.getByRole('textbox', { name: 'Folder name' });
        await expect(field).toHaveFocus();

        // Blank is not a name: sanitiseTitle would quietly turn it into
        // "Untitled", so Create stays out of reach until something is typed.
        await expect(
            canvas.getByRole('button', { name: 'Create' })
        ).toBeDisabled();

        await userEvent.type(field, 'Drafts');
        await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
        await expect(handlers.onSubmit).toHaveBeenCalledWith('Drafts');
    }}
>
    {#snippet template(args)}
        <ul class="bg-background w-full max-w-2xl p-6">
            <FileTreeNameRow {...args} />
        </ul>
    {/snippet}
</Story>

<Story
    name="Document"
    args={{ kind: 'document', taken: ['Two'], ...handlers }}
    play={async ({ canvas }) => {
        // The extension is shown rather than typed — it is part of the filename.
        await expect(canvas.getByText('.md')).toBeInTheDocument();

        const field = canvas.getByRole('textbox', { name: 'Document name' });
        await userEvent.type(field, 'Chapter Three{Enter}');
        await expect(handlers.onSubmit).toHaveBeenCalledWith('Chapter Three');
    }}
>
    {#snippet template(args)}
        <ul class="bg-background w-full max-w-2xl p-6">
            <FileTreeNameRow {...args} />
        </ul>
    {/snippet}
</Story>

<Story
    name="Name Taken"
    args={{ kind: 'document', taken: ['Two'], ...handlers }}
    play={async ({ canvas }) => {
        const field = canvas.getByRole('textbox', { name: 'Document name' });
        await userEvent.type(field, 'Two');

        // Caught before the write is attempted. The filesystem guard behind
        // createDocument is still the authority — this only stops the writer
        // typing a name that was never going to work.
        await expect(
            canvas.getByText('A document called "Two" already exists')
        ).toBeInTheDocument();
        await expect(
            canvas.getByRole('button', { name: 'Create' })
        ).toBeDisabled();
        await expect(field).toHaveAttribute('aria-invalid', 'true');
    }}
>
    {#snippet template(args)}
        <ul class="bg-background w-full max-w-2xl p-6">
            <FileTreeNameRow {...args} />
        </ul>
    {/snippet}
</Story>
