<script lang="ts" module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { expect, fn } from 'storybook/test';

    import Format from '$lib/components/Editor/Format/Format.svelte';
    import FormatGroup from '$lib/components/Editor/Format/FormatGroup.svelte';
    import FormatInsertImage from '$lib/components/Editor/Format/FormatInsertImage.svelte';

    import * as m from '$lib/paraglide/messages';

    const { Story } = defineMeta({
        title: 'Editor/Format/FormatInsertImage',
        component: FormatInsertImage,
        tags: ['autodocs'],
        argTypes: {
            disabled: { control: 'boolean' },
            editor: { control: false },
            onPick: { control: false }
        },
        parameters: {
            layout: 'fullscreen',
            docs: {
                description: {
                    component:
                        'Image insert button. The button only opens a hidden file input; the picked file goes to `onPick`, which writes it into the document’s own folder and returns the relative path the TipTap image node is created with. Shown without a live editor, so nothing is inserted.'
                }
            }
        }
    });

    // The chosen file reaches `onPick` through the hidden input's change event.
    // `userEvent.upload` can't drive an input that CSS has hidden, so the file is
    // attached the way the browser would — through a DataTransfer.
    function pickFile(canvasElement: HTMLElement, file: File): void {
        const input =
            canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
        if (!input) throw new Error('no file input rendered');

        const data = new DataTransfer();
        data.items.add(file);
        input.files = data.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
</script>

<Story
    name="Default"
    args={{
        disabled: false,
        editor: undefined,
        onPick: fn(async () => 'diagram.png')
    }}
    play={async ({ args, canvas, canvasElement }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_format_image() })
        ).toBeEnabled();

        const file = new File(['not really a png'], 'diagram.png', {
            type: 'image/png'
        });
        pickFile(canvasElement, file);
        await expect(args.onPick).toHaveBeenCalledWith(file);

        // The input resets itself, or picking the same file twice would be silent.
        const input =
            canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
        await expect(input?.value).toBe('');
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatInsertImage {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>

<Story
    name="Disabled"
    args={{ disabled: true, editor: undefined, onPick: fn() }}
    play={async ({ args, canvas }) => {
        await expect(
            canvas.getByRole('button', { name: m.content_format_image() })
        ).toBeDisabled();
        await expect(args.onPick).not.toHaveBeenCalled();
    }}
>
    {#snippet template(args)}
        <div
            class="bg-background flex min-h-96 w-full items-center justify-center p-6"
        >
            <Format>
                <FormatGroup>
                    <FormatInsertImage {...args} />
                </FormatGroup>
            </Format>
        </div>
    {/snippet}
</Story>
