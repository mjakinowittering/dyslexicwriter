<script lang="ts">
    import {
        ArrowLeft01Icon,
        EyeIcon,
        Heading01Icon,
        Heading02Icon,
        LeftToRightListBulletIcon,
        LeftToRightListNumberIcon,
        NextIcon,
        PlayIcon,
        PreferenceHorizontalIcon,
        PreviousIcon,
        Redo03Icon,
        Settings01Icon,
        StopIcon,
        Summation01Icon,
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
    // Drawn at 0.8 of the editor's real geometry (its title row is `h-14`/56 with
    // `size-8`/32 controls, so 44 and 26 here). The values are written out rather
    // than scaled with a transform, which would blur the type. That makes this an
    // independent mock: it shares no sizes with the editor and must not try to.
    //
    // The height is capped by the screen it sits on. The welcome stack leaves
    // about 430px inside a 900-tall window, and going past that would make this
    // screen scroll for the first time — which is what trims the toolbar to eight
    // controls and crops the paper at the bottom edge.

    // The same document the design record shows in the editor, so the two agree.
    const WORD_COUNT = 1284;
    const readingTime = calculateReadingTime(WORD_COUNT).display;

    // Joined, bordered segments — `Format.Group` passes `variant="outline"`.
    const FORMAT_GROUPS: IconSvgElement[][] = [
        [Undo03Icon, Redo03Icon],
        [Heading01Icon, Heading02Icon],
        [TextBoldIcon, TextItalicIcon],
        [LeftToRightListBulletIcon, LeftToRightListNumberIcon]
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
                class="border-input inline-flex h-[26px] min-w-[26px] items-center justify-center border border-l-0 px-2 first:rounded-l-md first:border-l last:rounded-r-md"
            >
                <Icon class="size-[13px]" {icon} />
            </span>
        {/each}
    </span>
{/snippet}

<!-- Hidden below `sm`: there is no width for it to read as anything, and the two
     cards are the whole job on a phone. -->
<div
    aria-hidden="true"
    class="border-border bg-background shadow-sheet hidden w-full max-w-4xl overflow-hidden rounded-xl border sm:block"
>
    <!-- The title bar. The three lights are the one colour here that is not a
         token — see the <style> block. -->
    <div class="border-border bg-muted flex h-9 items-center border-b px-3">
        <span class="flex items-center gap-2">
            <span class="close size-2.5 rounded-full"></span>
            <span class="minimise size-2.5 rounded-full"></span>
            <span class="maximise size-2.5 rounded-full"></span>
        </span>
    </div>

    <!-- Rail, title row and toolbar row — the editor's own chrome, smaller. -->
    <div class="border-border flex gap-2.5 border-b">
        <div
            class="border-border flex shrink-0 items-center justify-center border-r px-2.5"
        >
            <span
                class="inline-flex h-[26px] w-[29px] items-center justify-center"
            >
                <Icon class="size-4" icon={ArrowLeft01Icon} />
            </span>
        </div>

        <div class="flex min-w-0 flex-1 flex-col">
            <div class="flex h-11 items-center gap-2 px-2.5">
                <!-- The title IS the filename, so the extension rides an addon
                     beside it and the two read as one name. -->
                <span
                    class="border-input flex h-[26px] w-full max-w-[307px] min-w-0 items-center rounded-md border"
                >
                    <span
                        class="flex min-w-0 flex-1 items-center truncate py-0 pr-[5px] pl-2 text-[11px] font-medium"
                    >
                        {m.welcome_preview_title()}
                    </span>
                    <span
                        class="text-muted-foreground flex items-center pr-[7px] text-[11px] font-medium"
                    >
                        .md
                    </span>
                </span>
                <span
                    class="ml-auto inline-flex h-[26px] w-[29px] items-center justify-center"
                >
                    <Icon class="size-[13px]" icon={Settings01Icon} />
                </span>
            </div>

            <div class="flex items-center gap-2 px-2.5 pb-1.5">
                <span class="flex flex-1 items-start gap-4">
                    {#each FORMAT_GROUPS as icons, i (i)}
                        {@render group(icons)}
                    {/each}
                </span>
                <span class="ml-auto">{@render group(TRANSPORT)}</span>
            </div>
        </div>
    </div>

    <!-- Canvas (the well) → sheet (the paper). The paper runs off the bottom
         edge rather than ending, the way a real page continues below the fold. -->
    <div class="bg-canvas h-71 overflow-hidden px-[51px] pt-[45px]">
        <div
            class="border-border bg-sheet shadow-sheet mx-auto min-h-100 w-full max-w-[601px] rounded-[11px] border p-23"
        >
            <h3 class="mb-[19px] text-2xl leading-tight font-semibold">
                {m.welcome_preview_title()}
            </h3>
            <!-- Tailwind Typography's `prose-lg` line-height, which is what the
                 real document surface renders at. eslint's tailwind rule offers
                 `leading-1.7778` here; that is not a class, so the arbitrary
                 value stays. -->
            <p class="text-sm leading-[1.7778]">{m.welcome_preview_prose()}</p>
        </div>
    </div>

    <!-- The status bar, echoing the editor's own readouts. -->
    <div
        class="border-border text-muted-foreground flex h-[29px] items-center gap-[13px] border-t px-[13px] text-[11px]"
    >
        <span class="flex items-center gap-1.5">
            <Icon class="size-[13px]" icon={Summation01Icon} />
            <span
                >{m.content_word_count({
                    count: WORD_COUNT.toLocaleString()
                })}</span
            >
        </span>
        <span class="flex items-center gap-1.5">
            <Icon class="size-[13px]" icon={EyeIcon} />
            <span>{m.content_read_time({ time: readingTime })}</span>
        </span>
        <span class="ml-auto">{m.editor_saved_recent()}</span>
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
