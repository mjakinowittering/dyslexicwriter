<script lang="ts">
    import {
        FolderAddIcon,
        FolderCheckIcon,
        FolderOpenIcon
    } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as Empty from '$lib/components/ui/empty';

    import * as m from '$lib/paraglide/messages';

    import WelcomeCard from './WelcomeCard.svelte';

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
        onReopen
    }: {
        folderName?: string;
        error?: string;
        onSuggested: () => void;
        onChoose: () => void;
        onReopen: () => void;
    } = $props();
</script>

<Empty.Root>
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

    <Empty.Content class="max-w-2xl gap-4">
        <div class="grid w-full gap-4 sm:grid-cols-2">
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

        <!-- The browser blocks Downloads, the home folder and system folders
             outright. Say so before the picker does, so the refusal doesn't read
             as the app being broken. -->
        <p class="text-muted-foreground text-xs">{m.welcome_folder_hint()}</p>

        {#if error}
            <p class="text-destructive text-sm">{error}</p>
        {/if}
    </Empty.Content>
</Empty.Root>
