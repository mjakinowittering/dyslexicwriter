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
    // Full width, and as tall as its contents make it. No aspect ratio: tying
    // the window to 16:9 meant its width came from whatever vertical space the
    // welcome stack left over, and on a laptop-height screen that was nothing —
    // a 1920x1080 laptop at Windows' 125% scaling left it on its minimum with
    // most of the toolbar dropped. Nothing here is sized against the viewport
    // any more: the width is the column's and the height is whatever the rows
    // add up to. A window too short to hold it scrolls.
    //
    // The page inside runs on under the status bar, which is what a page looks
    // like when it carries on below the fold.

    // The same document the design record shows in the editor, so the two agree.
    const WORD_COUNT = 1284;
    const readingTime = calculateReadingTime(WORD_COUNT).display;

    // Every group the editor's toolbar has, in its order. Joined, bordered
    // segments — `Format.Group` passes `variant="outline"`.
    //
    // All six, always. The window is only ever drawn at the column's full width
    // from `lg` up — comfortably more than the row needs — and hidden below
    // that, so there is no longer a size at which a group has to be given up.
    // The three container queries that used to drop them are gone with the
    // ratio that made the window narrow in the first place.
    const FORMAT_GROUPS: IconSvgElement[][] = [
        [Undo03Icon, Redo03Icon],
        [Heading01Icon, Heading02Icon, Heading03Icon, Heading04Icon],
        [TextBoldIcon, TextItalicIcon],
        [LeftToRightListBulletIcon, LeftToRightListNumberIcon],
        [LeftToRightBlockQuoteIcon, MinusSignIcon],
        [TableIcon, Image01Icon]
    ];
    const TRANSPORT: IconSvgElement[] = [
        PreviousIcon,
        PlayIcon,
        StopIcon,
        NextIcon,
        PreferenceHorizontalIcon
    ];
</script>

{#snippet group(icons: IconSvgElement[])}
    <span class="flex items-center rounded-md">
        {#each icons as icon (icon)}
            <span
                class="border-input inline-flex h-7 min-w-7 items-center justify-center border border-l-0 px-2 first:rounded-l-md first:border-l last:rounded-r-md"
            >
                <Icon class="size-3.5" {icon} />
            </span>
        {/each}
    </span>
{/snippet}

<!-- Shown from `lg`, where the column is wide enough for the whole toolbar,
     and hidden below it — on a phone or a tablet held in portrait the two cards
     are the whole job, and a mock this narrow would read as a smudge rather
     than as an editor. It is shown or hidden, never resized.

     `shrink-0` because the stack above it is a flex column: without it a short
     window would squeeze the window's height back out of it, which is the
     scaling this component no longer does. It runs off the bottom of a short
     window instead, and the screen scrolls. -->
<div aria-hidden="true" class="hidden w-full shrink-0 lg:block">
    <!-- The window. Full width of the column, and as tall as its own parts make
         it. Nothing here is measured against anything: no ratio, no container
         queries, no floor, no height of its own.

         `overflow-hidden` is what rounds the corners off the rows inside. -->
    <div
        class="border-border bg-background shadow-sheet relative flex w-full flex-col overflow-hidden rounded-xl border"
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
                    <!-- `gap-4`, drawn from the editor's own `space-x-5`: the
                         row always carries all six groups now. -->
                    <span class="flex flex-1 items-start gap-4">
                        {#each FORMAT_GROUPS as icons, i (i)}
                            {@render group(icons)}
                        {/each}
                    </span>
                    <span class="ml-auto">{@render group(TRANSPORT)}</span>
                </div>
            </div>
        </div>

        <!-- Canvas (the well) → sheet (the paper). Neither has a height: the
             well is as deep as the page inside it, the page is as long as the
             writing on it, and the window is the sum of that and the two chrome
             rows above. Nothing is cropped to fit and nothing is scaled — on a
             window with no room for all of it the component simply runs on past
             the fold and the welcome screen scrolls.

             No bottom padding on the well, so the sheet's last inch sits under
             the status bar and the page has no visible bottom edge — it carries
             on the way a real one does. `p-16` is about the margin a page is
             set with, and deep enough at the foot that what the status bar
             covers is margin rather than writing.

             `reading-font` on the sheet alone, as PageEditor does it: the
             writing is in OpenDyslexic, the chrome around it stays in Geist. -->
        <div class="bg-canvas px-12 pt-8">
            <div
                class="border-border bg-sheet shadow-sheet reading-font mx-auto w-full max-w-xl rounded-xl border p-16"
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
