import type { DocumentLocation } from '$lib/fs';
import { parentPath, pathSegments } from '$lib/models/document.model';

// Where a document is saved, as the steps the Files screen would show on the way
// to it: the working folder by name, each folder below it, then the file.
//
// A folder-document — `My Chapter/My Chapter.md`, the shape the app creates — is
// drawn on the Files screen as one row inside its parent, not as a folder with a
// document in it. Its own folder is dropped here for the same reason, so the
// editor and the file list describe the same place the same way.
export interface LocationSteps {
    // The working folder's name first, then each folder down to the document's.
    folders: string[];
    // The markdown file's name, extension included.
    file: string;
}

export function locationSteps(
    rootName: string,
    location: DocumentLocation
): LocationSteps {
    const folder = location.ownsFolder
        ? parentPath(location.folder)
        : location.folder;

    return {
        folders: [rootName, ...pathSegments(folder)],
        file: location.file
    };
}
