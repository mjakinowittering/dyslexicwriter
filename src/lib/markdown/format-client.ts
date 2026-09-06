import type { PrettierPreferences } from '$lib/models/prettier.model';

import type { FormatRequest, FormatResponse } from './format';

// The main-thread half of the formatter: hands markdown to the worker and waits.
//
// The one rule this file exists to enforce: **formatting must never fail a save.**
// Every failure path — no Worker at all, a worker that will not construct, a worker
// that errors mid-format, a Prettier throw — resolves with the UNFORMATTED body
// rather than rejecting.
//
// That is not politeness. `#scheduleRetry` in the document store has no give-up
// ceiling, so a rejection here would put a deterministically-failing document into
// a retry loop that can never succeed, and the writing would never reach disk. A
// tidier file is not worth an unsaved one.
//
// Keeping this the only module that reaches for the worker also keeps Prettier's
// ~250KB of standalone + markdown plugin in the worker chunk rather than the app's
// main bundle.
class MarkdownFormatter {
    #worker: Worker | null = null;
    #unavailable = false;
    #nextId = 1;

    // Resolvers are stored with the body they were asked about, so a worker that
    // dies with requests in flight can settle every one of them unformatted.
    #pending = new Map<
        number,
        { body: string; settle: (md: string) => void }
    >();

    async format(body: string, prefs: PrettierPreferences): Promise<string> {
        const worker = this.#ensureWorker();
        if (!worker) return body;

        const id = this.#nextId++;

        return new Promise<string>((resolve) => {
            this.#pending.set(id, { body, settle: resolve });

            try {
                worker.postMessage({
                    id,
                    body,
                    // Rebuilt as a plain object rather than forwarded. The caller
                    // reads these off `workspace.config`, which is `$state` — and a
                    // Svelte reactive proxy is not structured-cloneable, so posting
                    // one throws DataCloneError synchronously and takes the whole
                    // save down with it.
                    prefs: {
                        printWidth: prefs.printWidth,
                        proseWrap: prefs.proseWrap
                    }
                } satisfies FormatRequest);
            } catch {
                // Nothing is coming back for a request that was never sent, and
                // this method does not reject. Stand it down unformatted.
                this.#pending.delete(id);
                resolve(body);
            }
        });
    }

    // Constructed on first use rather than at import: a session that never edits a
    // document never pays for the worker or the Prettier bundle behind it.
    #ensureWorker(): Worker | null {
        if (this.#unavailable) return null;
        if (this.#worker) return this.#worker;

        // SSR-guarded like every other browser API here. The build is a static SPA,
        // but modules are still analysed.
        if (typeof Worker === 'undefined') {
            this.#unavailable = true;
            return null;
        }

        try {
            const worker = new Worker(
                new URL('./format.worker.ts', import.meta.url),
                { type: 'module' }
            );

            worker.onmessage = ({ data }: MessageEvent<FormatResponse>) => {
                const request = this.#pending.get(data.id);
                if (!request) return;

                this.#pending.delete(data.id);
                request.settle('body' in data ? data.body : request.body);
            };

            // A worker that fails to load or throws outside a request handler. The
            // requests it was carrying still have to be answered.
            worker.onerror = () => this.#giveUp();
            worker.onmessageerror = () => this.#giveUp();

            this.#worker = worker;
            return worker;
        } catch {
            this.#unavailable = true;
            return null;
        }
    }

    // Stand every in-flight request down unformatted and stop trying. Later saves
    // go straight through rather than paying the same failure again.
    #giveUp(): void {
        this.#unavailable = true;
        this.#worker?.terminate();
        this.#worker = null;

        for (const { body, settle } of this.#pending.values()) settle(body);
        this.#pending.clear();
    }
}

export const markdownFormatter = new MarkdownFormatter();
