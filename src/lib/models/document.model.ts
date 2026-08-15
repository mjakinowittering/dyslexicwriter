import * as v from 'valibot';

// A document's title doubles as its folder name and the basename of the markdown
// file inside it, so it is the one piece of user input that becomes a filesystem
// path. Everything here exists to keep a title from escaping its folder or
// producing a name the OS will reject.

export const TITLE_MAX_LENGTH = 120;
export const UNTITLED = 'Untitled';
export const MARKDOWN_EXTENSION = '.md';

// Characters that are illegal in a path segment on Windows, macOS or Linux, plus
// the ASCII control range. `/` and `\` are the dangerous ones — they would let a
// title traverse out of the working folder.
// eslint-disable-next-line no-control-regex -- deliberately matching C0 controls
const ILLEGAL_PATH_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

// Reserved device names on Windows. A folder called `CON` or `PRN` cannot be
// created there, and the failure is confusing, so rename them up front.
const RESERVED_NAMES = new Set([
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9'
]);

export const titleSchema = v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, 'A document needs a title'),
    v.maxLength(TITLE_MAX_LENGTH)
);

// Turn arbitrary user input into something safe to use as a folder name. Always
// returns a usable name — never an empty string — because the caller is about to
// create a directory with it.
export function sanitiseTitle(input: string): string {
    let name = input
        .replace(ILLEGAL_PATH_CHARS, '')
        // A leading dot hides the folder on Unix; a trailing dot or space is
        // silently stripped by Windows, which would desync our index from disk.
        .replace(/^[.\s]+/, '')
        .replace(/[.\s]+$/, '')
        .slice(0, TITLE_MAX_LENGTH)
        .trim();

    if (name.length === 0) return UNTITLED;
    if (RESERVED_NAMES.has(name.toUpperCase())) name = `${name}_`;

    return name;
}

// The markdown file's name within its own folder: `My Chapter/My Chapter.md`.
export function fileNameFor(title: string): string {
    return `${sanitiseTitle(title)}${MARKDOWN_EXTENSION}`;
}

// "Untitled", then "Untitled 2", "Untitled 3", … skipping names already taken.
// `taken` is the set of folder names currently in the working directory.
export function nextUntitledName(taken: ReadonlySet<string>): string {
    if (!taken.has(UNTITLED)) return UNTITLED;

    let n = 2;
    while (taken.has(`${UNTITLED} ${n}`)) n += 1;
    return `${UNTITLED} ${n}`;
}

export type Title = v.InferOutput<typeof titleSchema>;
