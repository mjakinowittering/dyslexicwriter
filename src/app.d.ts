/// <reference types="wicg-file-system-access" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces.
//
// There is no server tier in this app — no hooks, no `locals`, no sessions. The
// only ambient types worth declaring are the File System Access API ones, which
// are not yet in TypeScript's default lib.
declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }
}

export {};
