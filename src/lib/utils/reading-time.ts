import * as m from '$lib/paraglide/messages';

// Silent reading speed for adult prose. One definition, defaulted into both
// exports below, so a call site never restates it.
const WORDS_PER_MINUTE = 238;

// One populated pair, never three: seconds below a minute, minutes below an
// hour, hours plus the minutes left over above that. The parts the copy needs
// and nothing else — which unit reads is the caller's decision, not a string
// this module builds.
export interface ReadingTime {
    hours: number;
    minutes: number;
    seconds: number;
}

// How long a word count takes to read.
//
// The total is rounded up ONCE and then split. Flooring the hours off an
// unrounded total and ceiling the remainder separately is what used to render
// 119.5 minutes as "1 hour 60 minutes" — the rollover has nowhere to go.
export function readingTime(
    wordCount: number,
    wordsPerMinute: number = WORDS_PER_MINUTE
): ReadingTime {
    const totalMinutes = wordCount / wordsPerMinute;

    if (totalMinutes < 1) {
        return { hours: 0, minutes: 0, seconds: Math.ceil(totalMinutes * 60) };
    }

    const minutes = Math.ceil(totalMinutes);

    if (minutes < 60) {
        return { hours: 0, minutes, seconds: 0 };
    }

    return {
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
        seconds: 0
    };
}

// The reading-time copy for a word count.
//
// Every word of it lives in `messages/en.json`; all this does is pick which key
// the numbers fit, singular and plural included. Building the phrase here and
// passing it to a message as a parameter would put the app's one pluralised
// string in a `.ts` file, which is exactly what the message file exists to stop.
//
// One selection site rather than three: the status bar, the welcome screen's
// static preview and that component's stories all want the same sentence, and
// the preview deliberately shares no markup with the editor.
export function readingTimeLabel(
    wordCount: number,
    wordsPerMinute: number = WORDS_PER_MINUTE
): string {
    const { hours, minutes, seconds } = readingTime(wordCount, wordsPerMinute);

    if (hours > 0) {
        if (minutes === 0) {
            return hours === 1
                ? m.content_read_time_hour()
                : m.content_read_time_hours({ hours });
        }

        if (hours === 1) {
            return minutes === 1
                ? m.content_read_time_hour_minute()
                : m.content_read_time_hour_minutes({ minutes });
        }

        return minutes === 1
            ? m.content_read_time_hours_minute({ hours })
            : m.content_read_time_hours_minutes({ hours, minutes });
    }

    if (minutes > 0) {
        return minutes === 1
            ? m.content_read_time_minute()
            : m.content_read_time_minutes({ minutes });
    }

    return seconds === 1
        ? m.content_read_time_second()
        : m.content_read_time_seconds({ seconds });
}
