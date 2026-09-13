// A link the writer has just clicked in the editor: what the link card shows,
// and where it is drawn.
//
// `anchor` is the rendered `<a>` itself, which the card positions against. It
// belongs to ProseMirror's view and is only good until the next change redraws
// the paragraph — which is why the page closes the card on every update rather
// than holding on to it.
export interface LinkTarget {
    anchor: HTMLElement;
    href: string;
    text: string;
}
