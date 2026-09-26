<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, screen, userEvent } from 'storybook/test';

    import ToolbarLocation from '$lib/components/Editor/Toolbar/ToolbarLocation.svelte';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarLocation',
        component: ToolbarLocation,
        tags: ['autodocs'],
        argTypes: {
            location: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Where the open document is saved, beside its title. The button shows the path — only the nearest folder when the title row runs short — and opens a "Saved in" card drawing it as a miniature of the Files tree, with Show in Files.'
                }
            }
        }
    });

    // A folder-document, the shape the app creates: the Files screen draws it
    // as a row inside Book/Chapters, so that is the path shown here too.
    const args = {
        rootName: 'My writing',
        location: {
            folder: 'Book/Chapters/The Lantern Room',
            file: 'The Lantern Room.md',
            ownsFolder: true
        },
        onShowInFiles: fn()
    };
</script>

<!-- The title row is the container the button reads its width from, so each
     story wraps it in one at the width it is showing. -->
<Story
    name="Full"
    {args}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', {
                name: 'Saved in My writing, Book, Chapters'
            })
        ).toHaveTextContent(/My writing\s*\/\s*Book\s*\/\s*Chapters/);
    }}
>
    {#snippet template(args)}
        <div class="bg-background @container flex w-full p-6">
            <ToolbarLocation {...args} />
        </div>
    {/snippet}
</Story>

<!-- Settings panel open, or a narrow window: the nearest folder alone, with the
     whole path still in the button's name. -->
<Story
    name="Narrow"
    {args}
    play={async ({ canvas }) => {
        const button = canvas.getByRole('button', {
            name: 'Saved in My writing, Book, Chapters'
        });
        await expect(canvas.getByText('My writing')).not.toBeVisible();
        await expect(button).toBeVisible();
    }}
>
    {#snippet template(args)}
        <div class="bg-background @container flex w-96 p-6">
            <ToolbarLocation {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="Card Open"
    {args}
    play={async ({ canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', {
                name: 'Saved in My writing, Book, Chapters'
            })
        );
        const card = await screen.findByRole('dialog', { name: 'Saved in' });
        await expect(card).toHaveTextContent('The Lantern Room.md');
        await userEvent.click(
            screen.getByRole('button', { name: 'Show in Files' })
        );
        await expect(args.onShowInFiles).toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <div class="bg-background @container flex min-h-96 w-full p-6">
            <ToolbarLocation {...args} />
        </div>
    {/snippet}
</Story>
