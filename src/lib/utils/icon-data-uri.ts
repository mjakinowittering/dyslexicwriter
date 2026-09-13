import type { IconSvgElement } from '@hugeicons/svelte';

// A Hugeicons glyph as an SVG `data:` URI, for the places an icon has to be
// drawn by CSS rather than mounted as a component — a `mask-image` on generated
// content, where there is no element to render into.
//
// Built from the icon's own data rather than a copied path, so the glyph has
// one definition: the icon set's. The attribute names in that data are the
// camelCase JSX spellings (`strokeLinecap`), which an SVG document does not
// understand, and each part carries a React `key` that it must not see at all.
export function iconDataUri(icon: IconSvgElement): string {
    const parts = icon
        .map(([tag, attributes]) => {
            const rendered = Object.entries(attributes)
                .filter(([name]) => name !== 'key')
                .map(
                    ([name, value]) =>
                        `${kebabCase(name)}="${escapeAttribute(String(value))}"`
                )
                .join(' ');
            return `<${tag} ${rendered}/>`;
        })
        .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">${parts}</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function kebabCase(name: string): string {
    return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function escapeAttribute(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;');
}
