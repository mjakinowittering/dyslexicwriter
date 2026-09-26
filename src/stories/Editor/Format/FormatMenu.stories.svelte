<script lang="ts" module>
    import {
        LeftToRightListBulletIcon,
        TableIcon
    } from '@hugeicons/core-free-icons';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn, screen, userEvent } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatMenu from '$lib/components/Editor/Format/FormatMenu.svelte';
    import FormatMenuItem from '$lib/components/Editor/Format/FormatMenuItem.svelte';
    import Icon from '$lib/components/Icon/Icon.svelte';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatMenu',
        component: FormatMenu,
        tags: ['autodocs'],
        argTypes: {
            trigger: { control: false },
            children: { control: false },
            disabled: { control: 'boolean' },
            pressed: { control: 'boolean' },
            name: { control: 'text' },
            value: { control: 'text' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'The shared dropdown behind the Text style, Lists, Blocks and Insert menus. The trigger uses the toggle’s outline variant, so it sits at the toggle groups’ height, with a chevron after its label or icon; `pressed` gives it the registry’s `aria-pressed` look, and `value` finishes its accessible name ("Lists: Bullet list"). Each row is a `FormatMenuItem` — icon, label, and shortcut — as a radio, check or action item.'
                }
            }
        }
    });
</script>

<Story
    name="Pressed"
    args={{
        name: 'Lists',
        value: 'Bullet list',
        pressed: true,
        disabled: false
    }}
    play={async ({ canvas }) => {
        const trigger = canvas.getByRole('button', {
            name: 'Lists: Bullet list'
        });
        await expect(trigger).toHaveAttribute('aria-pressed', 'true');
        await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

        await userEvent.click(trigger);
        await expect(
            await screen.findByRole('menuitemcheckbox', {
                name: /Bullet list/
            })
        ).toHaveAttribute('aria-checked', 'true');
    }}
>
    {#snippet template({ trigger, children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-start justify-center p-6"
        >
            <Format>
                <FormatMenu {...args}>
                    {#snippet trigger()}
                        <Icon icon={LeftToRightListBulletIcon} />
                    {/snippet}
                    <FormatMenuItem
                        checked={true}
                        icon={LeftToRightListBulletIcon}
                        kind="check"
                        label="Bullet list"
                        onSelect={fn()}
                        shortcut={['Mod', 'Shift', '8']}
                    />
                </FormatMenu>
            </Format>
        </div>
    {/snippet}
</Story>

<!-- A menu with no on state: no `pressed`, so no `aria-pressed` at all. -->
<Story
    name="Actions"
    args={{ name: 'Insert', disabled: false }}
    play={async ({ canvas }) => {
        const trigger = canvas.getByRole('button', { name: 'Insert' });
        await expect(trigger).not.toHaveAttribute('aria-pressed');
    }}
>
    {#snippet template({ trigger, children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-start justify-center p-6"
        >
            <Format>
                <FormatMenu {...args}>
                    {#snippet trigger()}
                        <Icon icon={TableIcon} />
                    {/snippet}
                    <FormatMenuItem
                        icon={TableIcon}
                        kind="action"
                        label="Table"
                        onSelect={fn()}
                    />
                </FormatMenu>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{ name: 'Insert', disabled: true }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: 'Insert' })
        ).toBeDisabled();
    }}
>
    {#snippet template({ trigger, children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-start justify-center p-6"
        >
            <Format>
                <FormatMenu {...args}>
                    {#snippet trigger()}
                        <Icon icon={TableIcon} />
                    {/snippet}
                    <FormatMenuItem
                        icon={TableIcon}
                        kind="action"
                        label="Table"
                    />
                </FormatMenu>
            </Format>
        </div>
    {/snippet}
</Story>
