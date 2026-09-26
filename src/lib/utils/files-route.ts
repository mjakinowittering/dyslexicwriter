// The Files screen's route, in the one place it is spelled out. Plain `/` is the
// list as the writer left it; `?reveal=` names a document to open the folders
// down to, scroll to and highlight — the editor's "Show in Files".
//
// Unresolved on purpose: callers hand it to `resolve()` at the `goto`, which is
// where `svelte/no-navigation-without-resolve` looks for it.
//
// `reveal` is the markdown file's path relative to the working folder, as
// `documentPath` gives it. Null is the plain list.
export function filesRoute(reveal: string | null): '/' | `/?reveal=${string}` {
    return reveal === null ? '/' : `/?reveal=${encodeURIComponent(reveal)}`;
}
