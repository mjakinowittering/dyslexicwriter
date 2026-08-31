<script lang="ts">
    import {
        FolderAddIcon,
        FolderCheckIcon,
        FolderOpenIcon
    } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as AlertDialog from '$lib/components/ui/alert-dialog';
    import * as Empty from '$lib/components/ui/empty';

    import * as m from '$lib/paraglide/messages';

    import WelcomeCard from './WelcomeCard.svelte';
    import WelcomePreview from './WelcomePreview.svelte';

    // The screen shown before there is a working folder. Two shapes, one layout:
    //
    //  - first run: make a folder for me, or let me choose one
    //  - a folder we already know about but may not read yet: reopen it, or
    //    choose a different one if it has moved
    //
    // Deliberately store-free so Storybook can drive it. The Empty parts are
    // composed here rather than through EmptyState because its content block is
    // `max-w-sm` — too narrow for two cards side by side.
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

<!-- Full height, with the preview taking what the header and cards leave: the
     welcome screen is one screenful and never scrolls. -->
<div class="flex size-full min-h-0 flex-col space-y-12 py-12">
    <!-- `flex-none`: Empty.Root is itself `flex-1`, and left to grow it would
         take the height the preview below it is meant to have. -->
    <Empty.Root class="flex-none">
        <Empty.Header>
            <Empty.Media variant="icon">
                <Icon icon={FolderOpenIcon} />
            </Empty.Media>
            <!-- Empty.Title is text-sm by default, which the card headings below
            would then out-rank. -->
            <Empty.Title class="text-xl font-semibold">
                {folderName ? m.welcome_back_title() : m.welcome_title()}
            </Empty.Title>
            <Empty.Description>
                {folderName
                    ? m.welcome_back_description()
                    : m.welcome_description()}
            </Empty.Description>
        </Empty.Header>
    </Empty.Root>

    <div class="mx-auto max-w-2xl space-y-5 text-center">
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
         for. Sits outside Empty.Content rather than in it: the cards keep their
         `max-w-2xl` and the window gets the wider measure the route now allows.
         Shown in both states — a return visit waiting on permission is still a
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
