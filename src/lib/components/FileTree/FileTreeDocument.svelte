<script lang="ts">
    import {
        Delete02Icon,
        File01Icon,
        PencilEdit01Icon
    } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';

    import type { DocumentIndexEntry } from '$lib/models/config.model';
    import * as m from '$lib/paraglide/messages';
    import { relativeTime } from '$lib/utils/relative-time';

    // One document row in the Files tree: the title and when it was last edited,
    // with rename and delete beside them. The whole title block is the open
    // control, so the target is as large as the row allows.
    let {
        entry,
        onOpen,
        onRename,
        onDelete
    }: {
        entry: DocumentIndexEntry;
        onOpen: (entry: DocumentIndexEntry) => void;
        onRename: (entry: DocumentIndexEntry) => void;
        onDelete: (entry: DocumentIndexEntry) => void;
    } = $props();
</script>

<li class="flex items-center gap-2">
    <button
        class="hover:bg-muted/60 flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 text-left"
        onclick={() => onOpen(entry)}
        type="button"
    >
        <Icon class="text-muted-foreground shrink-0" icon={File01Icon} />
        <span class="flex min-w-0 flex-col">
            <span class="truncate font-medium">{entry.title}</span>
            <span class="text-muted-foreground text-sm">
                {m.files_modified({ when: relativeTime(entry.lastModified) })}
            </span>
        </span>
    </button>

    <Button
        aria-label={m.files_rename()}
        onclick={() => onRename(entry)}
        size="icon"
        variant="ghost"
    >
        <Icon icon={PencilEdit01Icon} />
    </Button>
    <Button
        aria-label={m.files_delete()}
        onclick={() => onDelete(entry)}
        size="icon"
        variant="ghost"
    >
        <Icon icon={Delete02Icon} />
    </Button>
</li>
