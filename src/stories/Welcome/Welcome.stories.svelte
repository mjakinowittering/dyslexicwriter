<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, screen, userEvent, waitFor } from 'storybook/test';

    import Welcome from '$lib/components/Welcome/Welcome.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Welcome/Welcome',
        component: Welcome,
        tags: ['autodocs'],
        args: {
            onSuggested: fn(),
            onChoose: fn(),
            onReopen: fn(),
            onDismissError: fn()
        },
        argTypes: {
            onSuggested: { control: false },
            onChoose: { control: false },
            onReopen: { control: false },
            onDismissError: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The screen shown before there is a working folder. First run offers to make a `DyslexicWriter` folder inside a folder the user picks, or to use one they already have. When a stored folder is waiting on permission, `folderName` swaps the first card for “Reopen …” — the click is the user gesture Chromium requires before `requestPermission`. Store-free by design: the route passes the handlers in.'
                }
            }
        }
    });
</script>

<script lang="ts">
    // The error dialog is controlled by the `error` prop, so dismissing it is
    // the owner clearing that prop — which here is the story rather than the
    // route. A literal arg would leave the dialog unable to close.
    let blockedError = $state<string>(m.welcome_folder_blocked());
</script>

<Story
    name="First run"
    play={async ({ args, canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', { name: /Start a new folder/ })
        );
        await expect(args.onSuggested).toHaveBeenCalled();

        await userEvent.click(
            canvas.getByRole('button', { name: /Choose your own/ })
        );
        await expect(args.onChoose).toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <div class="bg-background flex min-h-128 w-full items-center p-6">
            <div class="mx-auto w-full max-w-4xl">
                <Welcome {...args} />
            </div>
        </div>
    {/snippet}
</Story>

<Story
    args={{ folderName: 'My Writing' }}
    name="Reopen"
    play={async ({ args, canvas }) => {
        // The folder they already have replaces the offer to make one.
        await expect(
            canvas.queryByRole('button', { name: /Start a new folder/ })
        ).not.toBeInTheDocument();

        await userEvent.click(
            canvas.getByRole('button', {
                name: new RegExp(m.welcome_reopen_title({ name: 'My Writing' }))
            })
        );
        await expect(args.onReopen).toHaveBeenCalled();

        // A return visit isn't a first run, and shouldn't read like one.
        await expect(
            canvas.getByText(m.welcome_back_title())
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background flex min-h-128 w-full items-center p-6">
            <div class="mx-auto w-full max-w-4xl">
                <Welcome {...args} />
            </div>
        </div>
    {/snippet}
</Story>

<!-- A refused folder interrupts rather than sitting under the cards. The dialog
     is portaled to <body>, so it is queried through `screen`, not the canvas. -->
<Story
    name="With error"
    play={async ({ args, canvas }) => {
        const dialog = await screen.findByRole('alertdialog');
        await expect(dialog).toHaveTextContent(m.welcome_error_title());
        await expect(dialog).toHaveTextContent(m.welcome_folder_blocked());

        // Dismissing hands the error back to its owner to clear, and leaves the
        // screen behind usable — the point is that the user goes straight back
        // to picking a folder.
        await userEvent.click(
            screen.getByRole('button', { name: m.welcome_error_dismiss() })
        );
        await expect(args.onDismissError).toHaveBeenCalled();
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        );
        await expect(
            canvas.getByRole('button', { name: /Choose your own/ })
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div class="bg-background flex min-h-128 w-full items-center p-6">
            <div class="mx-auto w-full max-w-4xl">
                <Welcome
                    {...args}
                    error={blockedError}
                    onDismissError={() => {
                        blockedError = '';
                        args.onDismissError();
                    }}
                />
            </div>
        </div>
    {/snippet}
</Story>
