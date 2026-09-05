import { describe, expect, it, vi } from 'vitest';

import { ensurePermission } from '$lib/fs';

// A stored handle does not carry its permission grant across sessions, and the
// browser will only reopen that question from inside a user gesture — so the
// whole of this function is the difference between asking and merely checking.
//
// Getting it wrong is not a small bug in either direction. Prompting where the
// caller only meant to check throws in Chromium and takes `restore()` down with
// it on every launch; not prompting where the caller meant to ask leaves the
// writer looking at a folder they have already agreed to and no way in.
//
// Driven against a stand-in handle: an OPFS directory does not answer
// `queryPermission` at all, and the two answers that matter here cannot be
// arranged on a real one.
function handle(
    query: PermissionState,
    request: PermissionState = 'denied'
): {
    handle: FileSystemDirectoryHandle;
    queryPermission: ReturnType<typeof vi.fn>;
    requestPermission: ReturnType<typeof vi.fn>;
} {
    const queryPermission = vi.fn().mockResolvedValue(query);
    const requestPermission = vi.fn().mockResolvedValue(request);
    return {
        // Only the two methods under test; nothing else is reached.
        handle: {
            queryPermission,
            requestPermission
        } as unknown as FileSystemDirectoryHandle,
        queryPermission,
        requestPermission
    };
}

describe('ensurePermission', () => {
    it('takes a granted permission without asking again', async () => {
        const { handle: dir, requestPermission } = handle('granted');

        await expect(ensurePermission(dir)).resolves.toBe(true);
        // The silent path every return visit takes. A prompt here would be one
        // the user never triggered.
        expect(requestPermission).not.toHaveBeenCalled();
    });

    // The default, and the one `restore()` uses on load. Chromium rejects
    // `requestPermission` outside a user gesture, so a check that quietly
    // escalated to a prompt would throw on every launch instead of handing the
    // welcome screen a folder to offer.
    it('reports a lapsed grant rather than prompting for it', async () => {
        const { handle: dir, requestPermission } = handle('prompt');

        await expect(ensurePermission(dir)).resolves.toBe(false);
        expect(requestPermission).not.toHaveBeenCalled();
    });

    // The "Reopen" card and the folder picker, both of which are user gestures.
    it('asks when told to, and takes yes for an answer', async () => {
        const { handle: dir, requestPermission } = handle('prompt', 'granted');

        await expect(ensurePermission(dir, { prompt: true })).resolves.toBe(
            true
        );
        expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    });

    it('takes no for an answer too', async () => {
        const { handle: dir } = handle('prompt', 'denied');

        await expect(ensurePermission(dir, { prompt: true })).resolves.toBe(
            false
        );
    });

    // Read access alone is not enough: every document the app opens is one it
    // may be asked to save a moment later.
    it('asks for readwrite, never read', async () => {
        const { handle: dir, queryPermission } = handle('granted');

        await ensurePermission(dir);

        expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    });
});
