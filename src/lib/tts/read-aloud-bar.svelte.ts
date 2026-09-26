import type { TtsTransport } from './speech-controller.svelte';

// All the bar needs of the transport: whether a read is live, and a way to end one.
type ReadAloudTransport = Pick<TtsTransport, 'isPlaying' | 'stop'>;

/**
 * Whether the floating read-aloud bar is showing.
 *
 * The toolbar's Read aloud button opens the bar without starting a read — the
 * writer presses Play in it. So the bar has two reasons to be open: the writer
 * launched it and has not read yet, or a read is live. Once a read starts, only
 * the read holds it open, which is what makes every way a read ends close the
 * bar with nothing else to wire: Stop, the end of the text, and each
 * `speech.stop()` the page already makes on a document switch, a delete and
 * `pagehide`. A pause keeps `isPlaying` true, so pausing keeps it open.
 *
 * Build it during component init — the constructor registers an `$effect`.
 */
export class ReadAloudBar {
    #launched = $state(false);
    readonly #controller: ReadAloudTransport;

    constructor(controller: ReadAloudTransport) {
        this.#controller = controller;

        // Hand the bar over to the read the moment one starts. Play on nothing
        // to read never sets `isPlaying`, so the bar stays rather than vanishing.
        $effect(() => {
            if (this.#controller.isPlaying) this.#launched = false;
        });
    }

    get open(): boolean {
        return this.#launched || this.#controller.isPlaying;
    }

    launch(): void {
        this.#launched = true;
    }

    close(): void {
        this.#launched = false;
        this.#controller.stop();
    }
}
