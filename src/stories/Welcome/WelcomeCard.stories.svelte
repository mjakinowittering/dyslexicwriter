<script lang="ts" module>
    import { FolderAddIcon, FolderCheckIcon } from '@hugeicons/core-free-icons';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import WelcomeCard from '$lib/components/Welcome/WelcomeCard.svelte';

    const { Story } = defineMeta({
        title: 'Welcome/WelcomeCard',
        component: WelcomeCard,
        tags: ['autodocs'],
        args: { onclick: fn() },
        argTypes: {
            icon: { control: false },
            onclick: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'One of the large choices on the welcome screen. A `Button` rather than a `Card`: the whole thing is the click target, and a card-shaped `<div>` with a handler on it would be a button the keyboard cannot reach.'
                }
            }
        }
    });
</script>

<Story
    args={{
        icon: FolderAddIcon,
        title: 'Start a new folder',
        description:
            "We'll make a DyslexicWriter folder inside the one you pick."
    }}
    name="Default"
    play={async ({ args, canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', { name: /Start a new folder/ })
        );
        await expect(args.onclick).toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full max-w-md p-6">
            <WelcomeCard {...args} />
        </div>
    {/snippet}
</Story>

<Story
    args={{
        icon: FolderCheckIcon,
        title: 'Reopen “My Writing”',
        description:
            'Pick up where you left off. Your browser needs a quick yes.'
    }}
    name="Reopen"
>
    {#snippet template(args)}
        <div class="bg-background w-full max-w-md p-6">
            <WelcomeCard {...args} />
        </div>
    {/snippet}
</Story>
