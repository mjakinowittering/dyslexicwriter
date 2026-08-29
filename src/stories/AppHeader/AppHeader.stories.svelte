<script lang="ts" module>
    import { makePreferences } from '../support/fakes.svelte';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

    import AppHeader from '$lib/components/AppHeader/AppHeader.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'AppHeader/AppHeader',
        component: AppHeader,
        tags: ['autodocs'],
        args: {
            onChangeFolder: fn(),
            onLeaveFolder: fn()
        },
        argTypes: {
            hasFolder: { control: 'boolean' },
            onChangeFolder: { control: false },
            onLeaveFolder: { control: false },
            store: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The app chrome for `/`, shown across every state of it — the unsupported-browser screen, the folder picker and the Files list alike. The mark is there from the first paint; the theme toggle and the menu wait for a folder, because a theme has nowhere to save to before one is chosen (config.json lives in the folder) and both menu actions are about the folder itself. `store` defaults to the real workspace; these stories pass a stand-in so there is no folder involved.'
                }
            }
        }
    });
</script>

<script lang="ts">
    // One store per story, so a play can assert against the setter it just moved.
    const light = makePreferences({ theme: 'light' });
    const dark = makePreferences({ theme: 'dark' });
    const menu = makePreferences({ theme: 'light' });
</script>

<Story
    name="No folder"
    args={{ hasFolder: false }}
    play={async ({ canvas }) => {
        // Before a folder there is nothing to toggle and nothing to act on, so
        // the bar is the mark alone.
        await expect(canvas.getByText(m.header_app_name())).toBeVisible();
        await expect(
            canvas.queryByRole('button', { name: m.header_menu() })
        ).toBeNull();
        await expect(
            canvas.queryByRole('button', { name: m.header_theme_to_dark() })
        ).toBeNull();
    }}
/>

<Story
    name="Light"
    args={{ hasFolder: true }}
    play={async ({ canvas }) => {
        // The button offers the theme you would be moving to, and follows the
        // store once the choice is made.
        const toggle = canvas.getByRole('button', {
            name: m.header_theme_to_dark()
        });

        await userEvent.click(toggle);
        await expect(light.setTheme).toHaveBeenCalledWith('dark');
        await expect(
            canvas.getByRole('button', { name: m.header_theme_to_light() })
        ).toBeVisible();
    }}
>
    {#snippet template(args)}
        <AppHeader {...args} store={light} />
    {/snippet}
</Story>

<Story
    name="Dark"
    args={{ hasFolder: true }}
    play={async ({ canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', { name: m.header_theme_to_light() })
        );
        await expect(dark.setTheme).toHaveBeenCalledWith('light');
    }}
>
    {#snippet template(args)}
        <AppHeader {...args} store={dark} />
    {/snippet}
</Story>

<!-- One open-and-click per story. Selecting an item closes the menu, and
     bits-ui holds `pointer-events: none` on the body through the close
     animation, so reopening it in the same play races that rather than testing
     anything about the header. -->
<Story
    name="Menu — change folder"
    args={{ hasFolder: true }}
    play={async ({ args, canvas }) => {
        await userEvent.click(
            canvas.getByRole('button', { name: m.header_menu() })
        );

        // The menu portals to <body>, so it is outside the story's canvas.
        const menuItems = within(document.body);

        // The content mounts before it finishes opening, so wait for the items
        // to actually be visible rather than merely present.
        const changeFolder = await menuItems.findByRole('menuitem', {
            name: m.files_change_folder()
        });
        await waitFor(() => expect(changeFolder).toBeVisible());

        // Both folder actions live here now, and nothing else does.
        await expect(await menuItems.findAllByRole('menuitem')).toHaveLength(2);
        await expect(
            await menuItems.findByRole('menuitem', { name: m.files_leave() })
        ).toBeVisible();

        await userEvent.click(changeFolder);
        await expect(args.onChangeFolder).toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <AppHeader {...args} store={menu} />
    {/snippet}
</Story>

<Story
    name="Menu — forget folder"
    args={{ hasFolder: true }}
    play={async ({ args, canvas }) => {
        // A menu closed by the story before this one holds `pointer-events:
        // none` on <body> through its close animation, and these stories share
        // a page. Wait it out rather than racing it.
        await waitFor(() =>
            expect(getComputedStyle(document.body).pointerEvents).not.toBe(
                'none'
            )
        );

        await userEvent.click(
            canvas.getByRole('button', { name: m.header_menu() })
        );

        const leave = await within(document.body).findByRole('menuitem', {
            name: m.files_leave()
        });
        await waitFor(() => expect(leave).toBeVisible());

        await userEvent.click(leave);
        // The header only asks; the route's ConfirmDialog is what stands
        // between this and the folder actually being let go.
        await expect(args.onLeaveFolder).toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <AppHeader {...args} store={menu} />
    {/snippet}
</Story>
