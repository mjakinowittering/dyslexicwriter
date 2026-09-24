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
        // browser against the user's local filesystem.
        //
        // The fallback is `404.html`, not `index.html`, because GitHub Pages has
        // no SPA rewrite: it serves `404.html` for any path that isn't a real
        // file, which is how a reload of `/edit` reaches the app instead of a
        // 404 page.
        //
        // The routes ARE prerendered as well — see `prerender` in
        // `src/routes/+layout.ts` for why the shell per route is what makes
        // Pages answer the site's own URL with a 200 rather than a 404.
        adapter: adapter({ fallback: '404.html' }),
        // A project site serves from `https://<user>.github.io/<repo>/`, so every
        // asset URL has to carry that prefix. `BASE_PATH` is set by the deploy
        // workflow from `actions/configure-pages`; unset — dev, `vite preview`,
        // Storybook — it falls back to serving from the root. This is build
        // tooling, not app configuration: nothing here reaches `$env`.
        paths: {
            base: process.env.BASE_PATH ?? ''
        }
    }
};

export default config;
