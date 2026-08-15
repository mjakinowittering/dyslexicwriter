// The whole app is a client-side SPA. Every screen reads and writes the user's
// local filesystem through the File System Access API, which exists only in the
// browser — there is nothing meaningful to render on a server, and no server tier
// to render it. `adapter-static` serves the SPA fallback for every route.
export const ssr = false;
export const prerender = false;
