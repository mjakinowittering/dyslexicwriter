// The app's tooltip entry point. Mirrors the shadcn `ui/tooltip` barrel exactly, but
// swaps in a project Root that dismisses the balloon across route transitions (see
// Tooltip.svelte). Import from here, not from `$lib/components/ui/tooltip`.
import { Content, Portal, Provider, Trigger } from '$lib/components/ui/tooltip';

import Root from './Tooltip.svelte';

export {
    Root,
    Trigger,
    Content,
    Provider,
    Portal,
    //
    Root as Tooltip,
    Content as TooltipContent,
    Trigger as TooltipTrigger,
    Provider as TooltipProvider,
    Portal as TooltipPortal
};
