/// <reference lib="webworker" />

import {
    formatMarkdown,
    type FormatRequest,
    type FormatResponse
} from './format';

// The formatting half of a save, off the main thread.
//
// Prettier is genuinely blocking — a 12k-word chapter costs around 100ms and a
// novel-length one over a second — and autosave fires 5s after the last keystroke,
// so on the main thread that is a stall mid-sentence.
//
// Only the formatting moved. `toMarkdown` cannot: it needs DOMParser and
// @tiptap/html's browser build, and a worker has neither. Nor did the write, which
// stays on the main thread because `pagehide` fires an un-awaited flush on a page
// the browser may kill immediately, and a message hop is not something that path
// can afford to wait for.

const port = self as unknown as DedicatedWorkerGlobalScope;

port.onmessage = async ({ data }: MessageEvent<FormatRequest>) => {
    try {
        const body = await formatMarkdown(data.body, data.prefs);
        port.postMessage({ id: data.id, body } satisfies FormatResponse);
    } catch (cause) {
        // Answer the failure rather than letting the request hang: the client turns
        // this back into the unformatted markdown, and the save proceeds.
        port.postMessage({
            id: data.id,
            error: cause instanceof Error ? cause.message : String(cause)
        } satisfies FormatResponse);
    }
};
