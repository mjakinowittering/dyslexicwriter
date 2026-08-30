<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import Welcome from '$lib/components/Welcome/Welcome.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Welcome/Welcome',
        component: Welcome,
        tags: ['autodocs'],
        args: {
            onSuggested: fn(),
            onChoose: fn(),
            onReopen: fn()
        },
        argTypes: {
            onSuggested: { control: false },
            onChoose: { control: false },
            onReopen: { control: false }
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

<Story
    args={{ error: m.welcome_folder_blocked() }}
    name="With error"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByText(m.welcome_folder_blocked())
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
