<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { Editor } from '@tiptap/core';
    import { expect, screen, userEvent, waitFor } from 'storybook/test';

    import LinkDialog from '$lib/components/Editor/Link/LinkDialog.svelte';

    import { documentExtensions } from '$lib/markdown';
    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Link/LinkDialog',
        component: LinkDialog,
        tags: ['autodocs'],
        argTypes: {
            editor: { control: false },
            open: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Adds a link, or changes one. The range is captured as it opens: a selection seeds **Text**, and a caret inside a link seeds both fields and offers **Remove link**. Only `http:`, `https:` and `mailto:` addresses are accepted, and a bare `www.` gains `https://`. The Link extension itself stays permissive, so links already in a writer’s files keep their mark. Driven here by a headless editor with the document’s own extension set.'
                }
            }
        }
    });

    // A headless editor over the document's real node set, with a range chosen.
    function editorWith(
        html: string,
        selection: { from: number; to: number }
    ): Editor {
        const editor = new Editor({
            content: html,
            extensions: documentExtensions()
        });
        editor.commands.setTextSelection(selection);
        return editor;
    }
</script>

<script lang="ts">
    // Built per render, so the light and dark runs of a story each get a
    // document of their own to change.
    //
    // "See the docs for more." — positions count from 1 inside the paragraph,
    // so "the docs" runs from 5 to 13.
    const addEditor = editorWith('<p>See the docs for more.</p>', {
        from: 5,
        to: 13
    });
    const editEditor = editorWith(
        '<p>See <a href="https://example.com">the docs</a> for more.</p>',
        { from: 7, to: 7 }
    );
    const invalidEditor = editorWith('<p>See the docs for more.</p>', {
        from: 5,
        to: 13
    });

    let addOpen = $state(true);
    let editOpen = $state(true);
    let invalidOpen = $state(true);
</script>

<Story
    name="Add a link"
    play={async () => {
        const dialog = await screen.findByRole('dialog');
        await expect(dialog).toHaveTextContent(m.content_link_add_title());

        // The selection became the link text.
        await expect(screen.getByLabelText(m.content_link_label())).toHaveValue(
            'the docs'
        );
        await expect(
            screen.queryByRole('button', { name: m.content_link_remove() })
        ).not.toBeInTheDocument();

        await userEvent.type(
            screen.getByLabelText(m.content_link_uri()),
            'www.example.com'
        );
        await userEvent.click(
            screen.getByRole('button', { name: m.content_link_confirm() })
        );

        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        );
        // A bare www. was given its scheme on the way in.
        await expect(addEditor.getHTML()).toContain(
            'href="https://www.example.com"'
        );
        await expect(addEditor.getText()).toBe('See the docs for more.');
    }}
>
    {#snippet template()}
        <div class="bg-background min-h-128 w-full p-6">
            <LinkDialog bind:open={addOpen} editor={addEditor} />
        </div>
    {/snippet}
</Story>

<Story
    name="Edit and remove"
    play={async () => {
        const dialog = await screen.findByRole('dialog');
        await expect(dialog).toHaveTextContent(m.content_link_edit_title());

        // A caret inside the link seeds both fields from the link itself.
        await expect(screen.getByLabelText(m.content_link_label())).toHaveValue(
            'the docs'
        );
        await expect(screen.getByLabelText(m.content_link_uri())).toHaveValue(
            'https://example.com'
        );

        await userEvent.click(
            screen.getByRole('button', { name: m.content_link_remove() })
        );

        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        );
        // The link is gone and the words it held are not.
        await expect(editEditor.getHTML()).not.toContain('<a');
        await expect(editEditor.getText()).toBe('See the docs for more.');
    }}
>
    {#snippet template()}
        <div class="bg-background min-h-128 w-full p-6">
            <LinkDialog bind:open={editOpen} editor={editEditor} />
        </div>
    {/snippet}
</Story>

<!-- These links land in files on disk and are opened from the editor, so a
     script address is refused outright rather than stored. -->
<Story
    name="Invalid address"
    play={async () => {
        await screen.findByRole('dialog');
        const uri = screen.getByLabelText(m.content_link_uri());

        await userEvent.type(uri, 'javascript:alert(1)');
        await userEvent.click(
            screen.getByRole('button', { name: m.content_link_confirm() })
        );

        await expect(
            await screen.findByText(m.content_link_uri_error())
        ).toBeInTheDocument();
        await expect(uri).toHaveAttribute('aria-invalid', 'true');
        await expect(screen.getByRole('dialog')).toBeInTheDocument();
        await expect(invalidEditor.getHTML()).not.toContain('<a');
    }}
>
    {#snippet template()}
        <div class="bg-background min-h-128 w-full p-6">
            <LinkDialog bind:open={invalidOpen} editor={invalidEditor} />
        </div>
    {/snippet}
</Story>
