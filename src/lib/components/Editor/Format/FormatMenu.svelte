<script lang="ts">
    import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
    import type { Snippet } from 'svelte';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import { toggleVariants } from '$lib/components/ui/toggle';
    import * as Tooltip from '$lib/components/ui/tooltip';

    import * as m from '$lib/paraglide/messages';

    // One dropdown on the formatting row. Text style, Lists, Blocks and Insert
    // all render through this, so the four look and behave as one control.
    //
    // They group controls the toolbar cap already allows — they add no
    // formatting, only a place to put it — which is what keeps them apart from
    // the bubble and slash menus the cap rules out.
    //
    // The trigger is drawn with the toggle's own outline variant, so it sits
    // beside the toggle groups at their height and border. `pressed` is the
    // registry's `aria-pressed` look, for a menu whose choice is in force at the
    // selection (a list, a quote); a menu with no on state leaves it undefined
    // and gets no `aria-pressed` at all.
    let {
        name,
        value,
        trigger,
        children,
        disabled,
        pressed
    }: {
        // What the menu is: the tooltip, and the front of the accessible name.
        name: string;
        // What it is set to at the selection — "Heading 2" — so a screen reader
        // hears "Text style: Heading 2" rather than a bare "Text style".
        value?: string;
        trigger: Snippet;
        children: Snippet;
        disabled: boolean;
        pressed?: boolean;
    } = $props();

    const ariaLabel = $derived(
        value ? m.content_format_menu_label({ menu: name, value }) : name
    );
</script>

<DropdownMenu.Root>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props: tooltipProps })}
                <DropdownMenu.Trigger {disabled}>
                    {#snippet child({ props: menuProps })}
                        <button
                            {...tooltipProps}
                            {...menuProps}
                            aria-label={ariaLabel}
                            aria-pressed={pressed}
                            class={toggleVariants({ variant: 'outline' })}
                            type="button"
                        >
                            {@render trigger()}
                            <span class="text-muted-foreground">
                                <Icon class="size-3" icon={ArrowDown01Icon} />
                            </span>
                        </button>
                    {/snippet}
                </DropdownMenu.Trigger>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
            <span>{name}</span>
        </Tooltip.Content>
    </Tooltip.Root>
    <!-- Wider than the trigger it hangs from, to fit a label and a shortcut.

         Focus is left to bits-ui. Every item's command focuses the editor, or
         opens the link dialog, before the menu closes — and bits-ui hands focus
         back to the trigger only when nothing else has taken it, as on Escape.
         The toolbar suite pins both. -->
    <DropdownMenu.Content class="w-72">
        {@render children()}
    </DropdownMenu.Content>
</DropdownMenu.Root>
