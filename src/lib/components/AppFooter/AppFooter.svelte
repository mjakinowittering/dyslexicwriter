<script lang="ts">
    import { Separator } from '$lib/components/ui/separator';

    import {
        authorUrl,
        licenseUrl,
        openDyslexicUrl,
        repositoryUrl
    } from '$lib/config/links';
    import * as m from '$lib/paraglide/messages';

    // The other half of the app chrome for `/` — the footer to AppHeader's
    // header, shown across every state of the route. The editor is not part of
    // this: it is the distraction-free surface and carries no chrome but its
    // own.
    //
    // Prop-free and store-free, so Storybook can render it with nothing behind
    // it. There is nothing here to configure: the URLs come from package.json
    // via $lib/config/links, and the rest is copy.
    //
    // Quiet by design. It sits under the welcome screen's editor preview and
    // under the document list, and must not compete with either — `text-xs` at
    // muted weight, one border to separate it from the content, and no motion.
</script>

<!-- `shrink-0` and bordered to mirror the header's `border-b`: both are chrome
     pinned to an edge, and neither gives up height to the content between them.
     The route's own scroll container is what keeps this on the bottom edge when
     the document list runs long. -->
<footer
    class="border-border text-muted-foreground shrink-0 border-t p-3 text-xs"
>
    <!-- Every href here leaves the app entirely, so `resolve()` has nothing to
         do with them — it exists to keep internal navigation inside the GitHub
         Pages base path, and none of these is internal. The rule can't see that
         through a variable, so it is turned off across this block and straight
         back on after it: anything added below is still checked. -->
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <div
        class="mx-auto flex max-w-3xl flex-col gap-x-4 gap-y-2 sm:flex-row sm:items-center sm:justify-between"
    >
        <!-- The author's note, in four runs of copy around its two links —
             Paraglide messages are plain strings and cannot carry markup, and
             `{@html}` is out. `_start`/`_middle`/`_end` are exactly the text
             between the anchors, so the whole sentence still lives in
             en.json and reads in order there. -->
        <p>
            {m.footer_note_start()}
            <a
                class="hover:text-foreground underline underline-offset-2"
                href={authorUrl}
                rel="noreferrer noopener"
                target="_blank">{m.footer_author()}</a
            >
            {m.footer_note_middle()}
            <a
                class="hover:text-foreground underline underline-offset-2"
                href={openDyslexicUrl}
                rel="noreferrer noopener"
                target="_blank">{m.footer_opendyslexic()}</a
            >{m.footer_note_end()}
        </p>

        <!-- Underlined rather than coloured. Both themes are neutral greys with
             no accent hue to spend on links, so an underline is the only thing
             distinguishing these from the sentence beside them — and colour
             alone would fail the a11y checks the stories run under. -->
        <p class="flex items-center gap-2">
            <a
                class="hover:text-foreground underline underline-offset-2"
                href={licenseUrl}
                rel="noreferrer noopener"
                target="_blank">{m.footer_license()}</a
            >
            <!-- The variant form, not a bare `h-3`: the shadcn separator carries
                 `data-[orientation=vertical]:h-full`, which outranks an
                 unqualified height and resolves to 0 in a row with no height of
                 its own — a rule nobody can see. Matching the variant is what
                 lets tailwind-merge drop it. -->
            <Separator
                class="data-[orientation=vertical]:h-3"
                orientation="vertical"
            />
            <a
                class="hover:text-foreground underline underline-offset-2"
                href={repositoryUrl}
                rel="noreferrer noopener"
                target="_blank">{m.footer_github()}</a
            >
        </p>
    </div>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
</footer>
