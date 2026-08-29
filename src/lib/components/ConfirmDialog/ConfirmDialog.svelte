<script lang="ts">
    import * as AlertDialog from '$lib/components/ui/alert-dialog';

    import * as m from '$lib/paraglide/messages';

    // A yes/no dialog for something the user cannot take back.
    //
    // Replaces window.confirm, which cannot be themed and reads as the browser
    // interrupting rather than the app asking. `description` is always rendered:
    // bits-ui wires aria-describedby from it, and the whole point of the dialog
    // is to say what is about to happen before it happens.
    //
    // `destructive` is about consequence, not emphasis — delete removes a folder
    // from the user's disk, whereas leaving a folder touches nothing. Only the
    // first earns the red.
    let {
        open = $bindable(false),
        title,
        description,
        confirmLabel,
        destructive = false,
        onConfirm
    }: {
        open?: boolean;
        title: string;
        description: string;
        confirmLabel: string;
        destructive?: boolean;
        onConfirm: () => void | Promise<void>;
    } = $props();

    // Close first, then do the work. Passing an `onclick` to AlertDialog.Action
    // displaces the primitive's own close handler rather than composing with it,
    // so the dialog is dismissed here explicitly — otherwise it sits open over
    // the very list the confirmed action is busy changing.
    async function handleConfirm() {
        open = false;
        await onConfirm();
    }
</script>

<AlertDialog.Root bind:open>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>{title}</AlertDialog.Title>
            <AlertDialog.Description>{description}</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>{m.confirm_cancel()}</AlertDialog.Cancel>
            <AlertDialog.Action
                onclick={handleConfirm}
                variant={destructive ? 'destructive' : 'default'}
            >
                {confirmLabel}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
