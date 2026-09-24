// The document model: the node set, the two converters, and the frontmatter split.
//
// Deliberately NOT the formatter. `fs/documents.ts` imports this barrel, and
// CLAUDE.md requires `fs/` to stay free of any Prettier or worker import — a
// re-export here puts both in its module graph however little the bundler
// eventually keeps. `formatMarkdown`, `markdownFormatter` and the port's request
// types are imported from `./format` and `./format-client` directly, by the two
// places that genuinely need them: the document store and the worker.
export { documentExtensions } from './extensions';
export { emptyDocument, fromMarkdown } from './from-markdown';
export type { Frontmatter } from './frontmatter';
export { joinFrontmatter, splitFrontmatter } from './frontmatter';
export { toMarkdown } from './to-markdown';
