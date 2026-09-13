<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import WelcomeHero from '$lib/components/Welcome/WelcomeHero.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Welcome/WelcomeHero',
        component: WelcomeHero,
        tags: ['autodocs'],
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The top of the welcome screen: the page’s one `<h1>` and a sentence under it. Our own markup rather than shadcn’s `Empty`, which is sized for an empty state rather than for the front of the app. No icon — the folder cards below carry their own.'
                }
            }
        }
    });
</script>

<Story
    args={{
        title: m.welcome_title(),
        description: m.welcome_description()
    }}
    name="First run"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('heading', { level: 1 })
        ).toHaveTextContent(m.welcome_title());
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full px-6">
            <WelcomeHero {...args} />
        </div>
    {/snippet}
</Story>

<Story
    args={{
        title: m.welcome_back_title(),
        description: m.welcome_back_description()
    }}
    name="Welcome back"
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('heading', { level: 1 })
        ).toHaveTextContent(m.welcome_back_title());
    }}
>
    {#snippet template(args)}
        <div class="bg-background w-full px-6">
            <WelcomeHero {...args} />
        </div>
    {/snippet}
</Story>
