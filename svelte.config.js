import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    compilerOptions: {
        runes: ({ filename }) =>
            filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
        experimental: {
            async: true
        }
    },
    kit: {
        // A pure static SPA: there is no server tier. Every route runs in the
        // browser against the user's local filesystem, so the whole app is served
        // from the SPA fallback rather than prerendered per-route.
        adapter: adapter({ fallback: 'index.html' })
    }
};

export default config;
