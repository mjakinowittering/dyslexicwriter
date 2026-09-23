<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import * as Popover from '$lib/components/ui/popover';

    import * as m from '$lib/paraglide/messages';
    import { linkDomain, normaliseLinkHref } from '$lib/utils/link';

    import type { LinkTarget } from './link-target';

    // What a clicked link points at, and the two things to do about it.
    //
    // Shown on click only — not on hover, and not when the caret moves into a
    // link, where it would pop up under a writer who is only editing nearby.
    // Clicking places the caret as it always did; this simply appears beside it.
    //
    // Not a bubble menu in the CLAUDE.md sense: it holds no formatting. Open is
    // the only way to follow a link from the editor, because clicking one never
    // navigates away from the writing.
    let {
        target,
        onEdit,
        onClose
    }: {
        target: LinkTarget | null;
        onEdit: () => void;
        onClose: () => void;
    } = $props();

    // The link outlives `target` being cleared: the card is still on screen for
    // its exit animation, and would otherwise fade out empty. A plain variable,
    // read back only through the derived that writes it.
    let lastTarget: LinkTarget | null = null;
    const shown = $derived.by(() => {
        if (target) lastTarget = target;
        return lastTarget;
    });

    const domain = $derived(shown ? linkDomain(shown.href) : '');

    // A relative link or an `ftp:` address from somebody's own files still
    // shows its address, but Open would resolve it against this app's URL, so
    // it is offered only for what the link dialog itself would make.
    const openable = $derived(
        shown ? normaliseLinkHref(shown.href) !== null : false
    );
</script>

<Popover.Root
    onOpenChange={(open) => {
        if (!open) onClose();
    }}
    open={target !== null}
>
    {#if shown}
        <!-- Anchored to the <a> in the editor rather than a trigger of its own.
             Focus stays in the writing both ways, so a writer who clicked a link
             only to put the caret there can carry on typing. -->
        <Popover.Content
            align="start"
            aria-label={m.content_link_card_label({
                domain: domain || shown.href
            })}
            customAnchor={shown.anchor}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onOpenAutoFocus={(event) => event.preventDefault()}
            side="bottom"
        >
            <div class="grid gap-1">
                <p class="font-medium">{shown.text}</p>
                {#if domain}
                    <p class="text-muted-foreground">{domain}</p>
                {/if}
                <p class="text-muted-foreground text-xs break-all">
                    {shown.href}
                </p>
            </div>
            <div class="flex justify-end gap-2">
                <Button onclick={onEdit} size="sm" variant="outline">
                    {m.content_link_edit()}
                </Button>
                {#if openable}
                    <Button
                        href={shown.href}
                        rel="noopener noreferrer"
                        size="sm"
                        target="_blank"
                    >
                        {m.content_link_open()}
                    </Button>
                {/if}
            </div>
        </Popover.Content>
    {/if}
</Popover.Root>
