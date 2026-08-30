<script lang="ts">
    import {
        Delete02Icon,
        File01Icon,
        PencilEdit01Icon
    } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

    import type { DocumentIndexEntry } from '$lib/models/document.model';
    import * as m from '$lib/paraglide/messages';
    import { relativeTime } from '$lib/utils/relative-time';

    import type { FileTreeActions } from './actions';
    import FileTreeRowMenu from './FileTreeRowMenu.svelte';

    // One document row in the Files tree: the title and when it was last edited,
    // with rename and delete in the row's menu. The whole title block is the open
    // control, so the target is as large as the row allows.
    //
    // No leading spacer before the file icon. The tree indents by exactly one
    // icon column, so with nothing in front of it this icon lands under the
    // folder icon of the folder holding it — see FileTree.svelte.
    let {
        entry,
        actions
    }: {
        entry: DocumentIndexEntry;
        actions: FileTreeActions;
    } = $props();
</script>

<!-- The hover surface is the row itself, menu included — the same treatment the
     folder rows carry, so the two kinds read as one list. -->
<li
    class="group/row hover:bg-muted/40 hover:ring-border focus-within:bg-muted/40 focus-within:ring-border flex items-center gap-2 rounded-md ring-1 ring-transparent"
>
    <button
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 p-2 text-left"
        onclick={() => actions.open(entry)}
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
