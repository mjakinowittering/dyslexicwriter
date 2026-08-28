// The whole app is a client-side SPA. Every screen reads and writes the user's
// local filesystem through the File System Access API, which exists only in the
// browser — there is nothing meaningful to render on a server, and no server tier
// to render it. `ssr = false` is what says so, and it is the invariant here.
//
// `prerender` is a separate question, and it is on: with SSR off it emits a
// *shell* per route, not rendered content — `index.html`, `edit.html` — and no
// component code runs at build time. That shell is what makes GitHub Pages
// answer the site's public URL with a 200 and the metadata in `app.html`.
// Without it the build has no `index.html`, Pages falls through to `404.html`,
// and the home page is served — app and all — under a 404 status that crawlers
// read as "nothing here". `404.html` still catches every other path, which is
// how a reload of a route survives.
export const ssr = false;
export const prerender = true;
