<script lang="ts">
    import {
        FolderOpenIcon,
        FolderRemoveIcon,
        Menu01Icon
    } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon/Icon.svelte';
    import * as Tooltip from '$lib/components/Tooltip';
    import Button from '$lib/components/ui/button/button.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

    import * as m from '$lib/paraglide/messages';

    // The app menu: the two folder actions, which used to sit as bare buttons in
    // the Files list's title row. Neither belongs to the list — they are about
    // the working folder itself — so they moved up here with the rest of the app
    // chrome, leaving the list with just "New document".
    //
    // Deliberately only these two. The menu is somewhere for folder-level actions
    // to live, not a home for everything that has nowhere else to go.
    let {
        onChangeFolder,
        onLeaveFolder
    }: {
        onChangeFolder: () => void;
        onLeaveFolder: () => void;
    } = $props();
</script>

<DropdownMenu.Root>
    <DropdownMenu.Trigger>
        {#snippet child({ props })}
            <!-- The tooltip wraps the trigger rather than the other way round, so
                 the balloon is anchored to the button and not to the open menu. -->
            <Tooltip.Provider>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        {#snippet child({ props: tooltipProps })}
                            <Button
                                {...tooltipProps}
                                {...props}
                                aria-label={m.header_menu()}
                                size="icon"
                                variant="ghost"
                            >
                                <Icon icon={Menu01Icon} />
                            </Button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content side="bottom">
                        <p>{m.header_menu()}</p>
                    </Tooltip.Content>
                </Tooltip.Root>
            </Tooltip.Provider>
        {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Content align="end">
        <DropdownMenu.Item onSelect={onChangeFolder}>
            <Icon icon={FolderOpenIcon} />
            {m.files_change_folder()}
        </DropdownMenu.Item>
        <!-- Not destructive: nothing on disk is touched, the browser just stops
             opening the folder. The confirm dialog behind it says as much. -->
        <DropdownMenu.Item onSelect={onLeaveFolder}>
            <Icon icon={FolderRemoveIcon} />
            {m.files_leave()}
        </DropdownMenu.Item>
    </DropdownMenu.Content>
</DropdownMenu.Root>
