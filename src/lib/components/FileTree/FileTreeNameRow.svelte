<script lang="ts">
    import { File01Icon, Folder01Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as InputGroup from '$lib/components/ui/input-group';

    import {
        MARKDOWN_EXTENSION,
        sanitiseTitle
    } from '$lib/models/document.model';
    import * as m from '$lib/paraglide/messages';

    // Naming a folder or a document as it is made, inline in the tree at the
    // depth the thing will live at — so the indentation says where it is going
    // rather than a dialog having to spell it out.
    //
    // `takenDocuments` and `takenFolders` are the sibling names already in that
    // directory, so a duplicate is caught before Create is reachable. They are
    // read off the tree, which is a scan snapshot and can be out of date; the
    // filesystem guard behind createFolder and createDocument is the actual
    // authority, and this is only here to stop the writer typing a name that was
    // never going to work.
    //
    // Both lists matter whichever kind is being named, because a document the app
    // creates IS a directory — `My Doc/My Doc.md` — so its name collides with a
    // folder's. Kept apart rather than concatenated only so the error can name
    // the thing that is actually in the way.
    let {
        kind,
        takenDocuments,
        takenFolders,
        onSubmit,
        onCancel
    }: {
        kind: 'folder' | 'document';
        takenDocuments: string[];
        takenFolders: string[];
        onSubmit: (name: string) => void;
        onCancel: () => void;
    } = $props();

    let value = $state('');
    let field = $state<HTMLInputElement | null>(null);

    // The name that would actually reach the disk — sanitiseTitle owns the
    // segment, so the duplicate check has to run against its output rather than
    // against what was typed.
    const safe = $derived(sanitiseTitle(value));
    const isBlank = $derived(value.trim().length === 0);
    const takenByDocument = $derived(!isBlank && takenDocuments.includes(safe));
    const takenByFolder = $derived(!isBlank && takenFolders.includes(safe));
    const isTaken = $derived(takenByDocument || takenByFolder);

    // Blank is disabled rather than allowed through: sanitiseTitle never returns
    // an empty string, so a bare Return would otherwise quietly make "Untitled".
    const canCreate = $derived(!isBlank && !isTaken);

    // Document first: where a name is held by both, the document is the row the
    // writer can see, and the folder behind it is this app's own shape.
    const error = $derived(
        takenByDocument
            ? m.files_exists_error({ title: safe })
            : takenByFolder
              ? m.files_folder_exists_error({ name: safe })
              : ''
    );

    // The row is opened deliberately, by a menu item or a button, and there is
    // nothing else on it to do — so it takes the caret with it.
    $effect(() => {
        field?.focus();
    });

    function submit() {
        if (!canCreate) return;
        onSubmit(value);
    }

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
        }
    }
</script>

<li class="flex flex-col gap-1.5 p-2">
    <div class="flex items-center gap-2">
        <Icon
            class="text-muted-foreground shrink-0"
            icon={kind === 'folder' ? Folder01Icon : File01Icon}
        />

        <InputGroup.Root class="min-w-0 flex-1">
            <InputGroup.Input
                aria-invalid={isTaken}
                aria-label={kind === 'folder'
                    ? m.files_folder_name_label()
                    : m.files_document_name_label()}
                bind:ref={field}
                bind:value
                {onkeydown}
            />
            <!-- The extension is part of the filename, so it reads as one thing
                 with the stem rather than something the writer has to remember
                 to type. Always .md: that is what the app creates, where a file
                 it merely opened keeps whatever extension it arrived with. -->
            {#if kind === 'document'}
                <InputGroup.Addon align="inline-end">
                    {MARKDOWN_EXTENSION}
                </InputGroup.Addon>
            {/if}
        </InputGroup.Root>

        <Button onclick={onCancel} size="sm" variant="outline">
            {m.confirm_cancel()}
        </Button>
        <Button disabled={!canCreate} onclick={submit} size="sm">
            {m.files_create()}
        </Button>
    </div>

    {#if error}
        <p class="text-destructive ms-6 text-sm">{error}</p>
    {/if}
</li>
