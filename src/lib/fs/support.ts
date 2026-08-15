// The whole app rests on the File System Access API, which today is Chromium-only
// (Chrome, Edge, Opera, Arc). Firefox and Safari implement none of it.
//
// We detect once and say so plainly rather than degrading into a half-working
// second storage path — see the "unsupported" screen on the Files route.
export function isFileSystemAccessSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.showDirectoryPicker === 'function'
    );
}
