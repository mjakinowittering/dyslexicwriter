import { describe, expect, it } from 'vitest';

import { locationSteps } from '$lib/utils/location-steps';

// The editor's "Saved in" has to describe a document the way the Files screen
// draws it, so each case below is one of the shapes the scan finds.
describe('locationSteps', () => {
    it('is the working folder alone for a loose file at the root', () => {
        expect(
            locationSteps('My writing', {
                folder: '',
                file: 'notes.md',
                ownsFolder: false
            })
        ).toEqual({ folders: ['My writing'], file: 'notes.md' });
    });

    it('drops a root folder-document’s own folder, as the tree does', () => {
        expect(
            locationSteps('My writing', {
                folder: 'My Chapter',
                file: 'My Chapter.md',
                ownsFolder: true
            })
        ).toEqual({ folders: ['My writing'], file: 'My Chapter.md' });
    });

    it('lists every folder down to a nested file-document', () => {
        expect(
            locationSteps('My writing', {
                folder: 'Book/Chapters',
                file: 'One.md',
                ownsFolder: false
            })
        ).toEqual({
            folders: ['My writing', 'Book', 'Chapters'],
            file: 'One.md'
        });
    });

    it('stops at the parent of a nested folder-document', () => {
        expect(
            locationSteps('My writing', {
                folder: 'Chapters/The Lantern Room',
                file: 'The Lantern Room.md',
                ownsFolder: true
            })
        ).toEqual({
            folders: ['My writing', 'Chapters'],
            file: 'The Lantern Room.md'
        });
    });

    it('keeps spaces and percent signs as they are', () => {
        expect(
            locationSteps('My writing', {
                folder: 'Drafts 100%/Part two',
                file: '50% done.md',
                ownsFolder: false
            })
        ).toEqual({
            folders: ['My writing', 'Drafts 100%', 'Part two'],
            file: '50% done.md'
        });
    });
});
