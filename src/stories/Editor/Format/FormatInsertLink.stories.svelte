<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, userEvent } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatInsertLink from '$lib/components/Editor/Format/FormatInsertLink.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatInsertLink',
        component: FormatInsertLink,
        tags: ['autodocs'],
        argTypes: {
            disabled: { control: 'boolean' },
            onOpen: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Link insert button. It only asks the page for the link dialog through `onOpen` — the dialog belongs to the page, because ⌘K and a link card’s Edit open the same one. Its tooltip names the shortcut, ⌘K on Apple platforms and Ctrl+K elsewhere.'
                }
            }
        }
    });
</script>

<Story
    name="Default"
    args={{ disabled: false, onOpen: fn() }}
    play={async ({ args, canvas }) => {
        const button = canvas.getByRole('button', {
            name: m.content_format_link()
        });
        await expect(button).toBeEnabled();

        await userEvent.click(button);
        await expect(args.onOpen).toHaveBeenCalledOnce();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatInsertLink {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{ disabled: true, onOpen: fn() }}
    play={async ({ args, canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_format_link() })
        ).toBeDisabled();
        await expect(args.onOpen).not.toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatInsertLink {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
