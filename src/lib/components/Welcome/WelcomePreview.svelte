<script lang="ts">
    import {
        ArrowLeft01Icon,
        EyeIcon,
        Heading01Icon,
        Heading02Icon,
        Heading03Icon,
        Heading04Icon,
        Image01Icon,
        LeftToRightBlockQuoteIcon,
        LeftToRightListBulletIcon,
        LeftToRightListNumberIcon,
        MinusSignIcon,
        NextIcon,
        PlayIcon,
        PreferenceHorizontalIcon,
        PreviousIcon,
        Redo03Icon,
        Settings01Icon,
        StopIcon,
        Summation01Icon,
        TableIcon,
        TextBoldIcon,
        TextItalicIcon,
        Undo03Icon
    } from '@hugeicons/core-free-icons';
    import type { IconSvgElement } from '@hugeicons/svelte';

    import Icon from '$lib/components/Icon/Icon.svelte';

    import * as m from '$lib/paraglide/messages';
    import { cn } from '$lib/utils';
    import calculateReadingTime from '$lib/utils/calculateReadingTime';

    // A picture of the editor, on the welcome screen, so it is obvious what the
    // app does before a folder is handed over. Deliberately a STATIC mock and not
    // a TipTap instance: a real editor here would be a second document with
    // nowhere to save it.
    //
    // Decorative in full — aria-hidden on the root, and not one focusable node
    // inside it. Every control below is a <span>, never a <button>: a fake close
    // button that takes a tab stop is worse than no preview at all.
    //
    // Drawn a step down from the editor's real chrome — its title row is `h-14`
    // with `size-8` controls, this is `h-11` with `size-7` — on Tailwind's own
    // scale rather than pixel values written out, so the mock lands on the same
    // grid as everything else. It stays an independent mock: it shares no sizes
    // with the editor and must not try to.
    //
    // Sized by the screen it sits on rather than by a height of its own: it
    // keeps a 16:9 window shape and takes its width from the height the welcome
    // stack leaves it, so this screen fits the window instead of scrolling it.
    // The page inside runs on under the status bar, which is what a page looks
    // like when it carries on below the fold.

    // The same document the design record shows in the editor, so the two agree.
    const WORD_COUNT = 1284;
    const readingTime = calculateReadingTime(WORD_COUNT).display;

    // Every group the editor's toolbar has, in its order. Joined, bordered
    // segments — `Format.Group` passes `variant="outline"`.
    //
    // The row cannot hold all six until the window is wide enough, so groups
    // drop off it as the window narrows — measured against the window's own
    // width (`@`), not the viewport's, because the mock is sized from the height
    // it is given and is routinely a good deal narrower than the screen it is
    // drawn on. Each threshold is the row width the group completes.
    //
    // They go from the right, the order the toolbar reads in — except the
    // headings, dropped first at the bottom end: four controls wide, and the
    // only group that buys back enough room to keep anything else.
    type FormatGroup = { icons: IconSvgElement[]; class?: string };

    const FORMAT_GROUPS: FormatGroup[] = [
        { icons: [Undo03Icon, Redo03Icon] },
        {
            class: 'hidden @[31rem]:flex',
            icons: [Heading01Icon, Heading02Icon, Heading03Icon, Heading04Icon]
        },
        { icons: [TextBoldIcon, TextItalicIcon] },
        {
            class: 'hidden @[43rem]:flex',
            icons: [LeftToRightListBulletIcon, LeftToRightListNumberIcon]
        },
        {
            class: 'hidden @[43rem]:flex',
            icons: [LeftToRightBlockQuoteIcon, MinusSignIcon]
        },
        { class: 'hidden @[51rem]:flex', icons: [TableIcon, Image01Icon] }
    ];
    const TRANSPORT: IconSvgElement[] = [
        PreviousIcon,
        PlayIcon,
        StopIcon,
        NextIcon,
        PreferenceHorizontalIcon
    ];
</script>

{#snippet group(icons: IconSvgElement[], className?: string)}
    <span class={cn('flex items-center rounded-md', className)}>
        {#each icons as icon (icon)}
            <span
                class="border-input inline-flex h-7 min-w-7 items-center justify-center border border-l-0 px-2 first:rounded-l-md first:border-l last:rounded-r-md"
            >
                <Icon class="size-3.5" {icon} />
            </span>
        {/each}
    </span>
{/snippet}

<!-- The slot the window sits in, and the size container it is measured
     against. It carries the window's own shape so it never claims height the
     window cannot use — it shrinks when the screen is short, but it does not
     grow, which is what would otherwise leave a dead band above and below the
     window on a tall screen. Hidden below `sm`, where there is no width for it
     to read as anything and the two cards are the whole job anyway. -->
<div
    aria-hidden="true"
    class="@container-size hidden aspect-video min-h-0 w-full items-center justify-center sm:flex"
>
    <!-- The window keeps a screen's shape at every size — `aspect-video`, with
         the width taken from the slot's height so the whole thing scales to fit
         rather than letterboxing. `26rem` is the floor: below that the toolbar
         has nothing left to give up, so a window that short scrolls instead.

         An inline-size container in its own right, which is what the toolbar
         groups below reveal against: the mock is routinely half the width of
         the viewport, so viewport breakpoints would show controls it has no
         room for. -->
    <div
        class="border-border bg-background shadow-sheet @container relative flex aspect-video w-[min(100%,max(26rem,calc(16/9*100cqh)))] flex-col overflow-hidden rounded-xl border"
    >
        <!-- The title bar. The three lights are the one colour here that is not a
             token — see the <style> block. -->
        <div
            class="border-border bg-muted flex h-9 shrink-0 items-center border-b px-3"
        >
            <span class="flex items-center gap-2">
                <span class="close size-2.5 rounded-full"></span>
                <span class="minimise size-2.5 rounded-full"></span>
                <span class="maximise size-2.5 rounded-full"></span>
            </span>
        </div>

        <!-- Rail, title row and toolbar row — the editor's own chrome, smaller. -->
        <div class="border-border flex shrink-0 gap-2.5 border-b">
            <div
                class="border-border flex shrink-0 items-center justify-center border-r px-2.5"
            >
                <span class="inline-flex size-7 items-center justify-center">
                    <Icon class="size-4" icon={ArrowLeft01Icon} />
                </span>
            </div>

            <div class="flex min-w-0 flex-1 flex-col">
                <div class="flex h-11 items-center gap-2 px-2.5">
                    <!-- The title IS the filename, so the extension rides an addon
                         beside it and the two read as one name. -->
                    <span
                        class="border-input flex h-7 w-full max-w-xs min-w-0 items-center rounded-md border"
                    >
                        <span
                            class="flex min-w-0 flex-1 items-center truncate py-0 pr-1 pl-2 text-xs font-medium"
                        >
                            {m.welcome_preview_title()}
                        </span>
                        <span
                            class="text-muted-foreground flex items-center pr-2 text-xs font-medium"
                        >
                            .md
                        </span>
                    </span>
                    <span
                        class="ml-auto inline-flex size-7 items-center justify-center"
                    >
                        <Icon class="size-3.5" icon={Settings01Icon} />
                    </span>
                </div>

                <div class="flex items-center gap-2 px-2.5 pb-1.5">
                    <!-- `gap-3` until the row is carrying all six groups,
                         where the editor's own `space-x-5` is what the spacing
                         is drawn from. -->
                    <span class="flex flex-1 items-start gap-3 @[51rem]:gap-4">
                        {#each FORMAT_GROUPS as formatGroup, i (i)}
                            {@render group(
                                formatGroup.icons,
                                formatGroup.class
                            )}
                        {/each}
                    </span>
                    <span class="ml-auto">{@render group(TRANSPORT)}</span>
                </div>
            </div>
        </div>

        <!-- Canvas (the well) → sheet (the paper). The well takes whatever the
             chrome above it leaves of the window. `overflow-hidden` is
             load-bearing twice over: it crops the page, and it is what lets a
             flex child shrink past its own content — without it the sheet
             would push the window taller than the screen shape it is meant to
             keep.

             The sheet fills the well, which runs on under the status bar, so
             the page has no visible bottom edge — it carries on below the fold
             the way a real one does. `p-16` on a `max-w-xl` page is about the
             margin a page is set with, and shallow enough that the title still
             shows when the well is only a band a few lines deep.

             `reading-font` on the sheet alone, as PageEditor does it: the
             writing is in OpenDyslexic, the chrome around it stays in Geist. -->
        <div class="bg-canvas flex-1 overflow-hidden px-12 pt-8">
            <div
                class="border-border bg-sheet shadow-sheet reading-font mx-auto size-full max-w-xl rounded-xl border p-16"
            >
                <h3 class="mb-5 text-2xl leading-tight font-semibold">
                    {m.welcome_preview_title()}
                </h3>
                <!-- `leading-relaxed` — the nearest step on the scale to Tailwind
                     Typography's `prose-lg`, which is what the real document surface
                     renders at. -->
                <p class="text-sm leading-relaxed">
                    {m.welcome_preview_prose()}
                </p>
            </div>
        </div>

        <!-- The status bar, echoing the editor's own readouts. Laid over the canvas
             rather than under it, and opaque, so the page runs beneath it. -->
        <div
            class="border-border bg-background text-muted-foreground absolute inset-x-0 bottom-0 flex h-7 items-center gap-3 border-t px-3 text-xs"
        >
            <span class="flex items-center gap-1.5">
                <Icon class="size-3.5" icon={Summation01Icon} />
                <span
                    >{m.content_word_count({
                        count: WORD_COUNT.toLocaleString()
                    })}</span
                >
            </span>
            <span class="flex items-center gap-1.5">
                <Icon class="size-3.5" icon={EyeIcon} />
                <span>{m.content_read_time({ time: readingTime })}</span>
            </span>
            <span class="ml-auto">{m.editor_saved_recent()}</span>
        </div>
    </div>
</div>

<style>
    /* The window's three lights. Functional colour, not furniture — the same
       call the read-aloud highlight makes (PageEditor.svelte), so these stay in
       the component that draws them and layout.css stays chroma 0. macOS hues
       pulled back off full saturation so they sit on a neutral palette without
       shouting; one lightness/chroma family, hue varying. */
    .close {
        background-color: oklch(0.7 0.17 27);
    }
    .minimise {
        background-color: oklch(0.79 0.15 78);
    }
    .maximise {
        background-color: oklch(0.72 0.16 148);
    }
    /* Dimmed a step against the near-black page, as the highlight is. */
    :global(.dark) .close {
        background-color: oklch(0.62 0.15 27);
    }
    :global(.dark) .minimise {
        background-color: oklch(0.7 0.13 78);
    }
    :global(.dark) .maximise {
        background-color: oklch(0.64 0.14 148);
    }
</style>
