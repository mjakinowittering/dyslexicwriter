<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, screen, userEvent, waitFor } from 'storybook/test';

    import ConfirmDialog from '$lib/components/ConfirmDialog/ConfirmDialog.svelte';
    import { Button } from '$lib/components/ui/button';

    const { Story } = defineMeta({
        title: 'ConfirmDialog/ConfirmDialog',
        component: ConfirmDialog,
        tags: ['autodocs'],
        argTypes: {
            open: { control: false },
            onConfirm: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The yes/no dialog for anything the user cannot take back, replacing `window.confirm` on the Files screen. Always renders a description — bits-ui wires `aria-describedby` from it, and the dialog exists to say what is about to happen. `destructive` is about consequence rather than emphasis: deleting a document removes a folder from the user’s disk, whereas leaving a folder touches nothing on it. Content is portaled to `<body>`, so tests query through `screen` rather than the story canvas.'
                }
            }
        }
    });
</script>

<script lang="ts">
    // One flag per story: every Story in a file shares this component instance,
    // so a single shared `open` would have one story's button opening the other
    // story's dialog on the autodocs page.
    let leaveOpen = $state(false);
    let deleteOpen = $state(false);
</script>

<!-- The Files screen's "forget this folder": irreversible in the sense that it
     costs another trip through the picker, but it destroys nothing, so the
     confirm button stays the default variant. -->
<Story
    name="Default"
    args={{
        title: 'Forget "my-writing"?',
        description:
            'Your writing stays on your disk untouched — DyslexicWriter just stops opening this folder, and you’ll pick one again next time.',
        confirmLabel: 'Forget this folder',
        onConfirm: fn()
    }}
    play={async ({ args, canvas }) => {
        await userEvent.click(canvas.getByRole('button', { name: 'Open' }));

        const dialog = await screen.findByRole('alertdialog');
        await expect(dialog).toHaveTextContent('Forget "my-writing"?');
        await expect(dialog).toHaveTextContent('stays on your disk untouched');

        // Cancelling has to be the safe path: it closes, and nothing runs.
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        );
        await expect(args.onConfirm).not.toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Button onclick={() => (leaveOpen = true)}>Open</Button>
            <ConfirmDialog {...args} bind:open={leaveOpen} />
        </div>
    {/snippet}
</Story>

<!-- Deleting a document: a real folder leaves the user's disk and there is no
     trash, which is what the destructive variant is reserved for. -->
<Story
    name="Destructive"
    args={{
        title: 'Delete "My Chapter"?',
        description:
            'This removes the folder and everything in it from your disk, and cannot be undone.',
        confirmLabel: 'Delete',
        destructive: true,
        onConfirm: fn()
    }}
    play={async ({ args, canvas }) => {
        await userEvent.click(canvas.getByRole('button', { name: 'Open' }));

        const dialog = await screen.findByRole('alertdialog');
        await expect(dialog).toHaveTextContent('cannot be undone');

        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(args.onConfirm).toHaveBeenCalledOnce());

        // Wait for the close animation to finish before handing back: axe runs
        // after this and would otherwise scan the dialog mid-fade, measuring
        // contrast against a half-transparent surface.
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        );
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Button onclick={() => (deleteOpen = true)}>Open</Button>
            <ConfirmDialog {...args} bind:open={deleteOpen} />
        </div>
    {/snippet}
</Story>
