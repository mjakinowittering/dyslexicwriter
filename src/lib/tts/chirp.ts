// LCARS-style playback chirps, synthesized with the Web Audio API — no audio
// assets. A start chirp rises, a stop chirp falls, each a quick two-note blip with
// a fast gain envelope so it reads as a soft computer "beep-boop" without clicks.

let ctx: AudioContext | null = null;

// Lazily create (and resume) a shared AudioContext. Returns null on the server or
// when Web Audio is unavailable. Browsers require a user gesture before audio can
// start — playback always begins from a click, so resume() succeeds there.
function audioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
}

// Play a single note as a gain-enveloped oscillator.
function tone(
    context: AudioContext,
    frequency: number,
    startAt: number,
    duration: number
): void {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startAt);

    // Fast attack + exponential decay — the classic short LCARS blip.
    const peak = 0.14;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain).connect(context.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
}

// Two notes back-to-back at the given frequencies.
//
// A chirp is punctuation, never the point — so a browser that refuses to give us a
// context (autoplay policy, too many live contexts) must cost the writer the blip
// and nothing else. Playback calls this on the way into and out of a read, and a
// throw here would take the whole read with it.
function chirp(frequencies: [number, number]): void {
    try {
        const context = audioContext();
        if (!context) return;
        const now = context.currentTime;
        const note = 0.09;
        tone(context, frequencies[0], now, note);
        tone(context, frequencies[1], now + note, note);
    } catch (error) {
        console.error('Read aloud could not play its chirp', error);
    }
}

// Rising blip — playback starting.
export function playStartChirp(): void {
    chirp([660, 988]); // E5 → B5
}

// Falling blip — playback stopping.
export function playStopChirp(): void {
    chirp([988, 660]); // B5 → E5
}
