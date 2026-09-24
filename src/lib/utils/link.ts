// The rules for a link the writer makes through the link dialog.
//
// Deliberately stricter than the Link extension's own `isAllowedUri`, and
// deliberately not enforced there. That check also runs when a file is parsed,
// so narrowing it would quietly unlink every relative link, `#anchor` and
// `ftp:` address already in someone's writing — and the next autosave would
// write those back as plain text. The extension's default already refuses
// `javascript:` and friends on the way in; this is what keeps the dialog to
// addresses a writer means by "a link".
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

// What the dialog stores for an address the writer typed, or null when it is
// not one it will make a link from.
//
// Returns the writer's own spelling rather than `URL.href`, which would add a
// trailing slash to `https://example.com` and put a change in the file they
// never made. A bare `www.` gains `https://`, because without a scheme the
// browser resolves it against the app's own address.
export function normaliseLinkHref(input: string): string | null {
    const trimmed = input.trim();
    if (trimmed === '') return null;

    // A space would end the markdown link's destination part-way through.
    if (/\s/.test(trimmed)) return null;

    const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;

    let url: URL;
    try {
        url = new URL(candidate);
    } catch {
        return null;
    }

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;

    if (url.protocol === 'mailto:') {
        return url.pathname.includes('@') ? candidate : null;
    }

    return url.hostname === '' ? null : candidate;
}

// Where a link goes, in the fewest words: the host of a web address, or the
// domain of an email one. Empty when there is nothing sensible to show.
export function linkDomain(href: string): string {
    let url: URL;
    try {
        url = new URL(href);
    } catch {
        return '';
    }

    if (url.protocol === 'mailto:') {
        const at = url.pathname.lastIndexOf('@');
        return at === -1 ? '' : url.pathname.slice(at + 1);
    }

    return url.hostname;
}
