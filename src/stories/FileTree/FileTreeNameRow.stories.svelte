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
            takenDocuments: { control: false },
            takenFolders: { control: false },
            initialValue: { control: false },
            submitLabel: { control: false },
            onSubmit: { control: false },
            onCancel: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Naming a folder or a document, inline in the tree at the depth the thing lives at. The same row renames one: it opens on the current name, selected. The submit button is out of reach while the field is blank or the name is already taken; `.md` sits in an addon for a document, because the title *is* the filename.'
                }
            }
        }
    });

    const handlers = { onSubmit: fn(), onCancel: fn() };
</script>

<Story
    name="Folder"
    args={{
        kind: 'folder',
        takenDocuments: [],
        takenFolders: ['Chapters'],
        ...handlers
    }}
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
    args={{
        kind: 'document',
        takenDocuments: ['Two'],
        takenFolders: [],
        ...handlers
    }}
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
    args={{
        kind: 'document',
        takenDocuments: ['Two'],
        takenFolders: [],
        ...handlers
    }}
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

<!-- The same row, renaming. It opens on the current name rather than empty, and
     the button says what it will do. -->
<Story
    name="Rename"
    args={{
        kind: 'document',
        initialValue: 'Chapter One',
        submitLabel: 'Rename',
        takenDocuments: ['Chapter One', 'Chapter Two'],
        takenFolders: [],
        ...handlers
    }}
    play={async ({ canvas }) => {
        const field = canvas.getByRole('textbox', { name: 'Document name' });
        await expect(field).toHaveFocus();
        await expect(field).toHaveValue('Chapter One');

        // Its own name sits in `takenDocuments` — it is on disk — so keeping it
        // must not read as a collision.
        await expect(
            canvas.getByRole('button', { name: 'Rename' })
        ).toBeEnabled();

        // A sibling's name still does.
        await userEvent.clear(field);
        await userEvent.type(field, 'Chapter Two');
        await expect(
            canvas.getByRole('button', { name: 'Rename' })
        ).toBeDisabled();

        await userEvent.clear(field);
        await userEvent.type(field, 'Chapter Nine{Enter}');
        await expect(handlers.onSubmit).toHaveBeenCalledWith('Chapter Nine');
    }}
>
    {#snippet template(args)}
        <ul class="bg-background w-full max-w-2xl p-6">
            <FileTreeNameRow {...args} />
        </ul>
    {/snippet}
</Story>

<Story
    name="Name Taken By A Folder"
    args={{
        kind: 'document',
        takenDocuments: [],
        takenFolders: ['Chapters'],
        ...handlers
    }}
    play={async ({ canvas }) => {
        const field = canvas.getByRole('textbox', { name: 'Document name' });
        await userEvent.type(field, 'Chapters');

        // A document the app creates is a directory of its own name, so a folder
        // already sitting there blocks it. The error names the folder rather than
        // claiming a document is in the way.
        await expect(
            canvas.getByText('A folder called "Chapters" already exists')
        ).toBeInTheDocument();
        await expect(
            canvas.getByRole('button', { name: 'Create' })
        ).toBeDisabled();
    }}
>
    {#snippet template(args)}
        <ul class="bg-background w-full max-w-2xl p-6">
            <FileTreeNameRow {...args} />
        </ul>
    {/snippet}
</Story>
