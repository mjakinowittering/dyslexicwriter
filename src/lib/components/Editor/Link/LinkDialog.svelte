<script lang="ts">
    import { getMarkRange, type Editor } from '@tiptap/core';
    import { untrack } from 'svelte';

    import { Button } from '$lib/components/ui/button';
    import * as Dialog from '$lib/components/ui/dialog';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';

    import * as m from '$lib/paraglide/messages';
    import { normaliseLinkHref } from '$lib/utils/link';

    // Adding a link, or changing one. Opened from the toolbar button, ⌘K, and a
    // link card's Edit — which is why `open` belongs to the page.
    //
    // The range is captured the moment it opens, because the dialog takes focus
    // and nothing after that can be trusted to still describe what the writer
    // had selected. ProseMirror keeps the selection in its state while the
    // editor is unfocused, so reading it here is reading what they chose.
    let {
        editor,
        open = $bindable(false)
    }: {
        editor: Editor | undefined;
        open?: boolean;
    } = $props();

    const uid = $props.id();

    let text = $state('');
    let uri = $state('');
    let editing = $state(false);
    let invalid = $state(false);
    let textField = $state<HTMLInputElement | null>(null);
    let uriField = $state<HTMLInputElement | null>(null);

    // Document positions, and deliberately not $state: a ProseMirror range
    // behind a proxy is the bug the read-aloud highlight already documents.
    let range: { from: number; to: number } | null = null;
    // The text the range held when the dialog opened. Unchanged, the link is
    // set over it in place, which keeps any bold or italic inside it.
    let originalText = '';

    function seed(instance: Editor): void {
        const { state } = instance;
        // ProseMirror's `$from`/`$to` are renamed on the way out: Svelte
        // reserves the `$` prefix for its own runes and stores.
        const { from, to, $from: start, $to: end } = state.selection;
        const linkType = state.schema.marks.link;
        const linked = linkType ? getMarkRange(start, linkType) : undefined;

        if (linkType && linked && from >= linked.from && to <= linked.to) {
            // Read the href off the linked text itself. At the link's trailing
            // edge the caret's own marks no longer include it, so asking the
            // editor for the active link's attributes comes back empty there.
            const href: unknown = state.doc
                .nodeAt(linked.from)
                ?.marks.find((mark) => mark.type === linkType)?.attrs.href;

            range = linked;
            editing = true;
            uri = typeof href === 'string' ? href : '';
            text = state.doc.textBetween(linked.from, linked.to);
        } else if (start.sameParent(end)) {
            range = { from, to };
            editing = false;
            uri = '';
            text = state.doc.textBetween(from, to);
        } else {
            // A selection across paragraphs. Replacing it with one line of link
            // text would delete the break between them, so the link goes in at
            // the end of the selection instead and the writing is left alone.
            range = { from: to, to };
            editing = false;
            uri = '';
            text = '';
        }

        originalText = text;
        invalid = false;
    }

    $effect(() => {
        if (!open) return;
        untrack(() => {
            if (editor) seed(editor);
        });
    });

    function apply(event: SubmitEvent): void {
        event.preventDefault();

        const href = normaliseLinkHref(uri);
        if (href === null) {
            invalid = true;
            uriField?.focus();
            return;
        }

        if (editor && range) {
            const label = text.trim() === '' ? href : text;
            let chain = editor.chain().focus();

            if (range.from !== range.to && label === originalText) {
                chain = chain.setTextSelection(range).setLink({ href });
            } else {
                chain = chain.insertContentAt(range, {
                    type: 'text',
                    text: label,
                    marks: [{ type: 'link', attrs: { href } }]
                });
            }

            chain.run();
        }

        open = false;
    }

    function remove(): void {
        if (editor && range) {
            editor
                .chain()
                .focus()
                .setTextSelection(range)
                .unsetLink()
                .setTextSelection(range.to)
                .run();
        }

        open = false;
    }
</script>

<Dialog.Root bind:open>
    <!-- Focus goes back to the writing, not to whatever opened the dialog: ⌘K
         has no trigger to return to, and the toolbar button is not where the
         writer was. The close button is off because Cancel already says it. -->
    <Dialog.Content
        onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor?.commands.focus();
        }}
        onOpenAutoFocus={(event) => {
            event.preventDefault();
            (text === '' ? textField : uriField)?.focus();
        }}
        showCloseButton={false}
    >
        <form class="grid gap-6" novalidate onsubmit={apply}>
            <Dialog.Header>
                <Dialog.Title>
                    {editing
                        ? m.content_link_edit_title()
                        : m.content_link_add_title()}
                </Dialog.Title>
            </Dialog.Header>

            <div class="grid gap-4">
                <div class="grid gap-2">
                    <Label for="{uid}-text">{m.content_link_label()}</Label>
                    <Input
                        id="{uid}-text"
                        autocomplete="off"
                        bind:ref={textField}
                        bind:value={text}
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="{uid}-uri">{m.content_link_uri()}</Label>
                    <Input
                        id="{uid}-uri"
                        aria-describedby={invalid ? `${uid}-error` : undefined}
                        aria-invalid={invalid || undefined}
                        autocomplete="off"
                        bind:ref={uriField}
                        bind:value={uri}
                        inputmode="url"
                        oninput={() => (invalid = false)}
                        placeholder={m.content_link_uri_placeholder()}
                        spellcheck={false}
                    />
                    {#if invalid}
                        <p id="{uid}-error" class="text-destructive text-sm">
                            {m.content_link_uri_error()}
                        </p>
                    {/if}
                </div>
            </div>

            <Dialog.Footer>
                {#if editing}
                    <Button
                        class="sm:me-auto"
                        onclick={remove}
                        type="button"
                        variant="destructive"
                    >
                        {m.content_link_remove()}
                    </Button>
                {/if}
                <Button
                    onclick={() => (open = false)}
                    type="button"
                    variant="outline"
                >
                    {m.confirm_cancel()}
                </Button>
                <Button type="submit">{m.content_link_confirm()}</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
