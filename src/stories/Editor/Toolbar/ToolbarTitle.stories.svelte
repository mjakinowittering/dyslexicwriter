<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import ToolbarTitle from '$lib/components/Editor/Toolbar/ToolbarTitle.svelte';
    import * as InputGroup from '$lib/components/ui/input-group';

    import { TITLE_MAX_LENGTH } from '$lib/models/document.model';
    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Toolbar/ToolbarTitle',
        component: ToolbarTitle,
        tags: ['autodocs'],
        argTypes: {
            children: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Width-capped container for the document title/name in the toolbar (max-w-sm), so long titles truncate rather than push the controls.'
                }
            }
        }
    });
</script>

<Story name="Default">
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarTitle {...args}>
                <span class="truncate font-semibold">
                    A rather long document title that should stay within its box
                </span>
            </ToolbarTitle>
        </div>
    {/snippet}
</Story>

<!-- What the editor header actually puts in here: the title as a filename, with
     the document's extension in an inline-end addon. -->
<Story name="Filename field">
    {#snippet template({ children, ...args })}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <ToolbarTitle {...args}>
                <InputGroup.Root>
                    <InputGroup.Input
                        aria-label={m.editor_title_label()}
                        class="font-medium"
                        maxlength={TITLE_MAX_LENGTH}
                        placeholder={m.content_title_placeholder()}
                        value="The Lantern Room"
                    />
                    <InputGroup.Addon align="inline-end">.md</InputGroup.Addon>
                </InputGroup.Root>
            </ToolbarTitle>
        </div>
    {/snippet}
</Story>
