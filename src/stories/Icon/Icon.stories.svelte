<script lang="ts" module>
    import {
        Brain02Icon,
        LeftToRightBlockQuoteIcon,
        MinusSignIcon,
        NextIcon,
        PreviousIcon,
        Summation01Icon,
        TextBoldIcon
    } from '@hugeicons/core-free-icons';
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import Icon from '$lib/components/Icon/Icon.svelte';

    const { Story } = defineMeta({
        title: 'Icon/Icon',
        component: Icon,
        tags: ['autodocs'],
        argTypes: {
            icon: { control: false },
            class: { control: 'text' }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Every icon in the app draws through here. Takes Hugeicons icon *data* rather than a component, and marks its `<svg>` as decorative by default — nearly every icon sits inside an already-labelled button. Size comes from Tailwind classes: unstyled it inherits the `size-4` that shadcn applies to icons inside buttons and toggles.'
                }
            }
        }
    });
</script>

<Story name="Default" args={{ icon: TextBoldIcon }}>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Icon {...args} />
        </div>
    {/snippet}
</Story>

<Story name="Sized" args={{ icon: Brain02Icon, class: 'text-primary size-8' }}>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Icon {...args} />
        </div>
    {/snippet}
</Story>

<!-- The glyphs with no 1:1 Lucide equivalent, side by side so a wrong-looking
     choice is obvious at a glance rather than only in the running app. -->
<Story name="Judgement Calls">
    {#snippet template()}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center gap-6 p-6"
        >
            <Icon class="size-6" icon={Summation01Icon} />
            <Icon class="size-6" icon={PreviousIcon} />
            <Icon class="size-6" icon={NextIcon} />
            <Icon class="size-6" icon={MinusSignIcon} />
            <Icon class="size-6" icon={LeftToRightBlockQuoteIcon} />
        </div>
    {/snippet}
</Story>
