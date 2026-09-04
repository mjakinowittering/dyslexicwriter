<script lang="ts" module>
    import { FolderOffIcon, InboxIcon } from '@hugeicons/core-free-icons';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect } from 'storybook/test';

    import EmptyState from '$lib/components/EmptyState/EmptyState.svelte';
    import { Button } from '$lib/components/ui/button';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'EmptyState/EmptyState',
        component: EmptyState,
        tags: ['autodocs'],
        argTypes: {
            icon: { control: false },
            action: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Generic empty-state scaffold: an optional icon, a title, a description, and an optional `action` snippet (e.g. a CTA button). Always centered.'
                }
            }
        }
    });
</script>

<Story
    name="Default"
    args={{
        icon: InboxIcon,
        title: 'No items yet',
        description: 'Items you create will show up here.'
    }}
    play={async ({ canvas }) => {
        await expect(canvas.getByText('No items yet')).toBeInTheDocument();
        // No `action`, so the empty content block is left out entirely.
        await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <EmptyState {...args} />
        </div>
    {/snippet}
</Story>

{#snippet createAction()}
    <Button>Create item</Button>
{/snippet}

<Story
    name="With Action"
    args={{
        icon: InboxIcon,
        title: 'No items yet',
        description: 'Get started by creating your first item.',
        action: createAction
    }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: 'Create item' })
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <EmptyState {...args} />
        </div>
    {/snippet}
</Story>

<Story
    name="No Icon"
    args={{
        title: 'Nothing here',
        description: 'A surrounding header already carries the icon.'
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <EmptyState {...args} />
        </div>
    {/snippet}
</Story>

{#snippet missingFolderActions()}
    <div class="flex flex-wrap justify-center gap-2">
        <Button>{m.files_missing_retry()}</Button>
        <Button variant="outline">{m.files_leave()}</Button>
    </div>
{/snippet}

<!-- The Files screen's missing-folder state, in its own copy. Two actions rather
     than one, because nothing can tell a deleted folder from a drive that isn't
     mounted: look again once it is back, or let the handle go. -->
<Story
    name="Two Actions"
    args={{
        icon: FolderOffIcon,
        title: m.files_missing_title(),
        description: m.files_missing_description({ name: 'my-writing' }),
        action: missingFolderActions
    }}
    play={async ({ canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.files_missing_retry() })
        ).toBeInTheDocument();
        await expect(
            canvas.getByRole('button', { name: m.files_leave() })
        ).toBeInTheDocument();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <EmptyState {...args} />
        </div>
    {/snippet}
</Story>
