<script lang="ts">
    import {
        Delete02Icon,
        File01Icon,
        PencilEdit01Icon
    } from '@hugeicons/core-free-icons';
    import { untrack } from 'svelte';
    import { prefersReducedMotion } from 'svelte/motion';
    import { fade } from 'svelte/transition';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

    import {
        arrivalFadeDuration,
        arrivalHoldDuration,
        disclosureDuration,
        motionEasing
    } from '$lib/config/motion';
    import type { DocumentIndexEntry } from '$lib/models/document.model';
    import * as m from '$lib/paraglide/messages';
    import { formatFileSize } from '$lib/utils/file-size';
    import { relativeTime } from '$lib/utils/relative-time';

    import type { FileTreeActions } from './actions';
    import FileTreeNameRow from './FileTreeNameRow.svelte';
    import FileTreeRowMenu from './FileTreeRowMenu.svelte';

    // One document row in the Files tree: the title, when it was last edited and
    // how big it is, with rename and delete in the row's menu. The whole title block is the open
    // control, so the target is as large as the row allows.
    //
    // No leading spacer before the file icon. The tree indents by exactly one
    // icon column, so with nothing in front of it this icon lands under the
    // folder icon of the folder holding it — see FileTree.svelte.
    //
    // While `renaming`, the row gives way to the naming field rather than opening
    // a dialog — the writer edits the name where the name is.
    //
    // `arriving` is the editor's "Show in Files" landing here: the row scrolls to
    // the middle of the view, takes focus so Enter reopens it, and wears a
    // highlighter wash for a moment so the eye lands on it too.
    let {
        entry,
        actions,
        renaming = false,
        arriving = false,
        takenDocuments = [],
        takenFolders = [],
        onRenameSubmit,
        onRenameCancel,
        onArrived
    }: {
        entry: DocumentIndexEntry;
        actions: FileTreeActions;
        renaming?: boolean;
        arriving?: boolean;
        takenDocuments?: string[];
        takenFolders?: string[];
        onRenameSubmit?: (name: string) => void;
        onRenameCancel?: () => void;
        // The highlight has gone, one way or the other.
        onArrived?: () => void;
    } = $props();

    let row = $state<HTMLLIElement | null>(null);
    let openButton = $state<HTMLButtonElement | null>(null);

    // Three flags, because the highlight ends two different ways. `held` is the
    // wash itself; dropping it plays the fade. `marked` is the heavier title and
    // darker "Edited" line, which stay until the fade has finished so the text
    // never sits lighter than its background. `cut` ends it at once, with no
    // fade — the writer has moved on, and a highlight still easing out over what
    // they are doing is in their way.
    let held = $state(false);
    let marked = $state(false);
    let cut = $state(false);

    function settle() {
        held = false;
        marked = false;
        onArrived?.();
    }

    $effect(() => {
        if (!arriving) return;

        // Read once: a preference flipped mid-arrival must not restart it.
        const reduced = untrack(() => prefersReducedMotion.current);
        held = true;
        marked = true;
        cut = false;

        const timers: number[] = [];

        // The folders on the way here may have only just opened and still be
        // sliding, which moves this row while they do — so wait for them before
        // measuring where the middle of the view is.
        timers.push(
            window.setTimeout(
                () => {
                    row?.scrollIntoView({
                        block: 'center',
                        behavior: reduced ? 'instant' : 'smooth'
                    });
                    openButton?.focus({ preventScroll: true });

                    // Reduced motion has no fade to watch, so the highlight
                    // stays until the writer does something rather than
                    // vanishing between one glance and the next.
                    if (!reduced) {
                        timers.push(
                            window.setTimeout(
                                () => (held = false),
                                arrivalHoldDuration
                            )
                        );
                    }
                },
                reduced ? 0 : disclosureDuration
            )
        );

        function interrupt() {
            cut = true;
            settle();
        }

        const options = { capture: true, once: true };
        window.addEventListener('pointerdown', interrupt, options);
        window.addEventListener('keydown', interrupt, options);

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
            window.removeEventListener('pointerdown', interrupt, options);
            window.removeEventListener('keydown', interrupt, options);
        };
    });
</script>

{#if renaming}
    <FileTreeNameRow
        initialValue={entry.title}
        kind="document"
        onCancel={() => onRenameCancel?.()}
        onSubmit={(name) => onRenameSubmit?.(name)}
        submitLabel={m.files_rename()}
        {takenDocuments}
        {takenFolders}
    />
{:else}
    <!-- The hover surface is the row itself, menu included — the same treatment
         the folder rows carry, so the two kinds read as one list. /70 rather
         than /40 because the rows sit on --panel, and at /40 the light wash
         was half as visible there as it had been on the page. `isolate` so
         the arrival wash can sit behind the row's contents (`-z-10`) without
         dropping behind the page. -->
    <li
        bind:this={row}
        class="group/row hover:bg-muted/70 hover:ring-border focus-within:bg-muted/70 focus-within:ring-border relative isolate flex items-center gap-2 rounded-md ring-1 ring-transparent"
    >
        <!-- Decoration only: nothing about the tree changes. The outer block
             is what `cut` removes — Svelte transitions are local, so taking the
             wash out with its parent skips the fade entirely. -->
        {#if !cut}
            {#if held}
                <span
                    aria-hidden="true"
                    class="bg-reveal ring-reveal-ring pointer-events-none absolute inset-0 -z-10 rounded-md ring-2"
                    data-arrival
                    onoutroend={settle}
                    out:fade={{
                        duration: arrivalFadeDuration,
                        easing: motionEasing
                    }}
                ></span>
            {/if}
        {/if}
        <button
            bind:this={openButton}
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 p-2 text-left"
            onclick={() => actions.open(entry)}
            type="button"
        >
            <Icon class="text-muted-foreground shrink-0" icon={File01Icon} />
            <span class="flex min-w-0 flex-col">
                <span
                    class={[
                        'truncate',
                        marked ? 'font-semibold' : 'font-medium'
                    ]}>{entry.title}</span
                >
                <!-- --muted-foreground drops below 4.5:1 on the dark wash, so
                     the line takes the body ink while the wash is there. -->
                <span
                    class={[
                        'text-sm',
                        marked ? 'text-foreground' : 'text-muted-foreground'
                    ]}
                >
                    {m.files_modified({
                        when: relativeTime(entry.lastModified),
                        size: formatFileSize(entry.size)
                    })}
                </span>
            </span>
        </button>

        <FileTreeRowMenu label={m.files_document_menu({ title: entry.title })}>
            <DropdownMenu.Item onSelect={() => actions.rename(entry)}>
                <Icon icon={PencilEdit01Icon} />
                {m.files_rename()}
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => actions.delete(entry)}>
                <Icon icon={Delete02Icon} />
                {m.files_delete()}
            </DropdownMenu.Item>
        </FileTreeRowMenu>
    </li>
{/if}
