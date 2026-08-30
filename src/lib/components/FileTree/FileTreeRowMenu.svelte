<script lang="ts">
    import { MoreHorizontalIcon } from '@hugeicons/core-free-icons';
    import type { Snippet } from 'svelte';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as Tooltip from '$lib/components/Tooltip';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

    // The overflow menu both kinds of row in the Files tree hang their actions
    // off. Only the trigger lives here — the items come in as `children`, so a
    // folder row and a document row share the button without sharing a menu.
    //
    // A menu rather than a row of icon buttons because a folder carries three
    // actions and a row of three glyphs beside every disclosure is more chrome
    // than list. Document rows follow it so the two read as one system.
    let {
        label,
        children
    }: {
        label: string;
        children: Snippet;
    } = $props();
</script>

<DropdownMenu.Root>
    <DropdownMenu.Trigger>
        {#snippet child({ props })}
            <!-- The tooltip wraps the trigger rather than the other way round, so
                 the balloon is anchored to the button and not to the open menu. -->
            <Tooltip.Provider>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        {#snippet child({ props: tooltipProps })}
                            <!-- Revealed by the row, not drawn on every one of
                                 them: a glyph per row is a lot of chrome for a
                                 list whose job is to get out of the way.
                                 Opacity rather than `hidden` so the row never
                                 changes width as the pointer crosses it, and so
                                 the button stays focusable — tabbing to it is
                                 what reveals it for a keyboard. `data-state`
                                 keeps it up while its own menu is open, after
                                 the pointer has moved on. -->
                            <Button
                                {...tooltipProps}
                                {...props}
                                aria-label={label}
                                class="shrink-0 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
                                size="icon-lg"
                                variant="ghost"
                            >
                                <!-- Sized explicitly: the Button base only
                                     forces size-4 on an svg with no size class
                                     of its own, and 16px here would be half the
                                     row icons beside it. -->
                                <Icon
                                    class="size-6"
                                    icon={MoreHorizontalIcon}
                                />
                            </Button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content side="bottom">
                        <p>{label}</p>
                    </Tooltip.Content>
                </Tooltip.Root>
            </Tooltip.Provider>
        {/snippet}
    </DropdownMenu.Trigger>

    <!-- w-auto because nova's menu content is pinned to its anchor's width, and
         this anchor is a 36px icon button — the labels would wrap at min-w-32. -->
    <DropdownMenu.Content align="end" class="w-auto">
        {@render children()}
    </DropdownMenu.Content>
</DropdownMenu.Root>
