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

// A document's location is a '/'-joined path relative to the working folder. The
// empty string is the working folder itself, so a loose `notes.md` sitting beside
// config.json has a folder of ''.
//
// Paths are assembled from segments the app already owns — sanitiseTitle handles
// each segment as it is created — and are never parsed out of user input, so
// nothing here re-sanitises. `resolveDirectory` in `fs/documents.ts` still refuses
// `.` and `..` as defence in depth.

export function pathSegments(path: string): string[] {
    return path.split('/').filter((segment) => segment.length > 0);
}

export function joinPath(...parts: string[]): string {
    return parts.filter((part) => part.length > 0).join('/');
}

// The path of the directory containing `path`, or '' when it sits at the root.
export function parentPath(path: string): string {
    const segments = pathSegments(path);
    segments.pop();
    return segments.join('/');
}

// The last segment of a path, or '' for the root.
export function lastSegment(path: string): string {
    return pathSegments(path).at(-1) ?? '';
}

// The full path of a document's markdown file: `Chapters/One.md`, or `notes.md`
// for one sitting at the root.
export function documentPath(location: {
    folder: string;
    file: string;
}): string {
    return joinPath(location.folder, location.file);
}

// The display title of a document is its file's basename. For the shape the app
// creates itself — `My Chapter/My Chapter.md` — that is the folder name too.
export function titleFromFileName(file: string): string {
    return file.endsWith(MARKDOWN_EXTENSION)
        ? file.slice(0, -MARKDOWN_EXTENSION.length)
        : file;
}

// One document as the Files screen knows it: where it lives, which of the two
// kinds it is, and when it last changed.
//
// A plain interface rather than a Valibot schema, because this is never read from
// disk. Every entry is built by `scanFolder` from a real file handle, so there is
// no untrusted input to validate — the folder itself is the only source there has
// ever been for this list.
export interface DocumentIndexEntry {
    // Display title: the markdown file's basename, without the extension.
    title: string;
    // The containing directory as a '/'-joined path relative to the working
    // folder. '' is the working folder itself, where a loose `notes.md` lives.
    folder: string;
    // File name within that folder, including the .md extension.
    file: string;
    // True when this document owns its folder — the `My Chapter/My Chapter.md`
    // shape the app creates, where renaming moves the folder and deleting removes
    // it whole. False for a markdown file the app merely found sitting among
    // others. Recomputed by every scan.
    ownsFolder: boolean;
    // Epoch milliseconds, shown against each document on the Files screen.
    lastModified: number;
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
