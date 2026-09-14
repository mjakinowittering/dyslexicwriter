import WELCOME_MARKDOWN from './welcome.md?raw';

// The note a newly made DyslexicWriter folder is seeded with, and the page the
// welcome screen's preview shows.
//
// Document content, not UI copy: it is markdown the app writes to disk as a
// document the writer owns, so it lives as the markdown it becomes rather than
// as a Paraglide string. One definition, two readers — the seed writes the whole
// file and the preview quotes its opening — so the page on the welcome screen is
// the page the writer then finds in their folder.
export { WELCOME_MARKDOWN };

// Also the folder name and the file's basename: `Welcome/Welcome.md`.
export const WELCOME_TITLE = 'Welcome';

// The first block of the note, which is kept free of markdown on purpose — the
// preview renders it as plain text, so a `**` here would show up literally.
// Line breaks are collapsed in case the file is ever hard-wrapped.
const [firstBlock = ''] = WELCOME_MARKDOWN.trim().split(/\n\s*\n/);
export const WELCOME_OPENING = firstBlock.replace(/\s*\n\s*/g, ' ');
