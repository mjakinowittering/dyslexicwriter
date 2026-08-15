// The reading-time and word-count chips are shared with the Files screen, so they
// stay in the Content tree; the editor's status bar composes them.
import TimeToRead from '$lib/components/Content/ContentTimeToRead/ContentTimeToRead.svelte';
import WordCount from '$lib/components/Content/ContentWordCount/ContentWordCount.svelte';

import Root from './Statusbar.svelte';

export { Root, TimeToRead, WordCount };
