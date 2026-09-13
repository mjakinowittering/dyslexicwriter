<script lang="ts">
    import {
        FolderAddIcon,
        FolderCheckIcon,
        FolderOpenIcon
    } from '@hugeicons/core-free-icons';

    import * as AlertDialog from '$lib/components/ui/alert-dialog';

    import * as m from '$lib/paraglide/messages';

    import WelcomeCard from './WelcomeCard.svelte';
    import WelcomeHero from './WelcomeHero.svelte';
    import WelcomePreview from './WelcomePreview.svelte';

    // The screen shown before there is a working folder. Two shapes, one layout:
    //
    //  - first run: make a folder for me, or let me choose one
    //  - a folder we already know about but may not read yet: reopen it, or
    //    choose a different one if it has moved
    //
    // Deliberately store-free so Storybook can drive it.
    let {
        folderName,
        error,
        onSuggested,
        onChoose,
        onReopen,
        onDismissError
    }: {
        folderName?: string;
        error?: string;
        onSuggested: () => void;
        onChoose: () => void;
        onReopen: () => void;
        onDismissError: () => void;
    } = $props();

    // A failed pick interrupts rather than waiting to be noticed under the
    // cards: it answers something the user just did, and what they do next is
    // try again.
    //
    // The error belongs to whoever passed it, so the dialog is controlled by the
    // prop and dismissing asks the owner to clear it rather than closing behind
    // its back. That is also what lets the same refusal open this twice: the
    // store blanks its error before each attempt and sets it again, so a dialog
    // remembering which message it had already dismissed would stay shut the
    // second time.
    const errorOpen = $derived(Boolean(error));

    // The message outlives the error being cleared: the dialog is still on
    // screen for its exit animation at that point and would otherwise fade out
    // empty. A plain variable rather than `$state` — it is only ever read back
    // through the derived that writes it.
    let lastError = '';
    const errorMessage = $derived.by(() => {
        if (error) lastError = error;
        return lastError;
    });
</script>

<!-- Sized by its parts rather than by the window. Nothing here stretches to
     fill a tall screen and nothing is squeezed on a short one — the preview at
     the foot brings its own height, and where there isn't room for it the
     screen scrolls like any other. -->
<!-- No top padding: the hero brings its own, and a second helping above it
     would only push the cards further down a short screen. -->
<div class="flex size-full min-h-0 flex-col space-y-12 pb-12">
    <WelcomeHero
        description={folderName
            ? m.welcome_back_description()
            : m.welcome_description()}
        title={folderName ? m.welcome_back_title() : m.welcome_title()}
    />

    <!-- The full width of the column, the same measure as the preview below, so
         each card is half the picture it introduces less the gap. `pb-12` on
         top of the stack's own spacing, so the choice and the picture of what
         it is for read as two things rather than one block. -->
    <div class="w-full space-y-5 pb-12 text-center">
        <div class="grid w-full gap-5 sm:grid-cols-2">
            {#if folderName}
                <WelcomeCard
                    description={m.welcome_reopen_description()}
                    icon={FolderCheckIcon}
                    onclick={onReopen}
                    title={m.welcome_reopen_title({ name: folderName })}
                />
            {:else}
                <WelcomeCard
                    description={m.welcome_suggested_description()}
                    icon={FolderAddIcon}
                    onclick={onSuggested}
                    title={m.welcome_suggested_title()}
                />
            {/if}
            <WelcomeCard
                description={m.welcome_choose_description()}
                icon={FolderOpenIcon}
                onclick={onChoose}
                title={m.welcome_choose_title()}
            />
        </div>

        <!-- The browser blocks Documents, Downloads, the home folder and system
             folders outright, in a dialog of its own we cannot replace or even
             see. Say so before the picker does, so the refusal doesn't read as
             the app being broken. -->
        <p class="text-muted-foreground text-xs">{m.welcome_folder_hint()}</p>
    </div>

    <!-- A picture of the editor, so the folder is handed over knowing what it is
         for. It and the cards share the column's full width, so their edges
         line up. Shown in both states — a return visit waiting on permission is still a
         screen with nothing on it saying what this app does. -->
    <WelcomePreview />
</div>

<!-- Portaled to <body> by bits-ui, so it sits outside the stack above. One
     button and no choice to make: there is nothing to confirm, only something to
     read before trying again. -->
<AlertDialog.Root
    onOpenChange={(open) => {
        if (!open) onDismissError();
    }}
    open={errorOpen}
>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>{m.welcome_error_title()}</AlertDialog.Title>
            <AlertDialog.Description>
                {errorMessage}
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <!-- `AlertDialog.Action` carries no close handler of its own — only
                 `Cancel` does — so the button dismisses the way Escape and the
                 overlay do, through the owner of the error. -->
            <AlertDialog.Action onclick={onDismissError}>
                {m.welcome_error_dismiss()}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
