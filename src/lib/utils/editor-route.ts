// The editor's route for a document, in the one place it is spelled out. Two
// screens build it — the Files screen to open a document, the editor to keep
// its own address bar pointing at the document once a rename or a first save
// has moved it — and a reload trusts whatever they wrote.
//
// Unresolved on purpose: callers hand it to `resolve()` at the `goto`, which is
// where `svelte/no-navigation-without-resolve` looks for it.
//
// `path` is the markdown file's path relative to the working folder, as
// `documentPath` gives it. Null is a document with no file yet: bare `/edit`.
export function editorRoute(
    path: string | null
): '/edit' | `/edit?doc=${string}` {
    return path === null ? '/edit' : `/edit?doc=${encodeURIComponent(path)}`;
}
