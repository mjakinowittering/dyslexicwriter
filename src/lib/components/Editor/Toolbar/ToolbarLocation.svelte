<script lang="ts">
    import {
        ArrowDown01Icon,
        File01Icon,
        Folder01Icon
    } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Popover from '$lib/components/ui/popover';
    import { Separator } from '$lib/components/ui/separator';

    import type { DocumentLocation } from '$lib/fs';
    import * as m from '$lib/paraglide/messages';
    import { locationSteps } from '$lib/utils/location-steps';

    // Where the open document is saved, always on show beside its title, so the
    // writer never has to work it out. The path is on the button itself rather
    // than hidden behind an icon: a folder icon alone does not say it can be
    // clicked, or that there is anything to learn by clicking it.
    //
    // Opens a "Saved in" card with the path drawn as a miniature of the Files
    // tree — one level per line, so a deep path stays readable where a one-line
    // breadcrumb would have to squash it — and one way on, Show in Files. It
    // holds no formatting and moves nothing: see the toolbar rule in CLAUDE.md.
    let {
        rootName,
        location,
        onShowInFiles
    }: {
        // The working folder's own name, the first step of every path.
        rootName: string;
        location: DocumentLocation;
        onShowInFiles: () => void;
    } = $props();

    const steps = $derived(locationSteps(rootName, location));
    const ancestors = $derived(steps.folders.slice(0, -1));
    const here = $derived(steps.folders.at(-1) ?? rootName);

    const headingId = $props.id();
</script>

<Popover.Root>
    <Popover.Trigger>
        {#snippet child({ props })}
            <!-- The whole path is the name at every width, so a narrow title
                 row hides the ancestors from sight but not from a screen
                 reader. `@max-2xl` reads the title row's width, which the
                 editor page makes a container — the row narrows when the
                 settings panel opens, not only when the window does. -->
            <Button
                {...props}
                aria-label={m.editor_location_label({
                    path: steps.folders.join(', ')
                })}
                variant="ghost"
            >
                <Icon class="text-muted-foreground" icon={Folder01Icon} />
                {#each ancestors as name, index (index)}
                    <span
                        class="text-muted-foreground font-normal @max-2xl:hidden"
                    >
                        {name}
                    </span>
                    <span
                        class="text-muted-foreground font-normal @max-2xl:hidden"
                    >
                        /
                    </span>
                {/each}
                <span>{here}</span>
                <Icon class="text-muted-foreground" icon={ArrowDown01Icon} />
            </Button>
        {/snippet}
    </Popover.Trigger>

    <!-- bits-ui's trigger announces `aria-haspopup="dialog"` but gives the
         content no role, so a screen reader is promised a dialog and then
         handed an unnamed group. The role is set here, named by the heading. -->
    <Popover.Content align="start" aria-labelledby={headingId} role="dialog">
        <p
            class="text-muted-foreground text-[13px] font-semibold"
            id={headingId}
        >
            {m.editor_location_heading()}
        </p>

        <div>{@render step(0)}</div>

        <Separator />

        <!-- The card is a flex column, so the button already spans it. -->
        <Button onclick={onShowInFiles} variant="outline">
            <Icon icon={Folder01Icon} />
            {m.editor_location_show()}
        </Button>
    </Popover.Content>
</Popover.Root>

<!-- One folder and everything below it, then the document itself. Plain rows,
     not controls: the card has one action and it is the button beneath.

     The Files tree's guide line and indent, less the disclosure chevron this has
     no use for: the line drops from the centre of the folder icon, and a child's
     icon lands where its parent's name starts. -->
{#snippet step(depth: number)}
    {#if depth < steps.folders.length}
        <div class="flex items-center gap-2 p-2">
            <Icon class="text-muted-foreground shrink-0" icon={Folder01Icon} />
            <span class="truncate">{steps.folders[depth]}</span>
        </div>
        <div class="border-border ms-4 border-s ps-1.75">
            {@render step(depth + 1)}
        </div>
    {:else}
        <div
            aria-current="location"
            class="bg-muted flex items-center gap-2 rounded-md p-2 font-semibold"
        >
            <Icon class="text-muted-foreground shrink-0" icon={File01Icon} />
            <span class="truncate">{steps.file}</span>
        </div>
    {/if}
{/snippet}
