import type { FolderNode } from '$lib/fs';
import type { DocumentIndexEntry } from '$lib/models/document.model';

// Everything a row in the Files tree can ask the screen above it to do.
//
// Passed as one object rather than six callbacks because FileTree renders
// itself: every prop it takes it also has to forward, and a recursive component
// threading six named callbacks through each level is unreadable. The screen
// owns the work, this is only the wiring.
export interface FileTreeActions {
    open: (entry: DocumentIndexEntry) => void;
    rename: (entry: DocumentIndexEntry) => void;
    delete: (entry: DocumentIndexEntry) => void;
    newDocument: (node: FolderNode) => void;
    newFolder: (node: FolderNode) => void;
    deleteFolder: (node: FolderNode) => void;
}

// The inline naming row: which folder it sits in, and which of the two things is
// being made. `parent` is a folder's path, so '' is the working folder itself.
//
// Held by the screen rather than by the tree, exactly as expansion state is —
// there is only ever one of these open, and a recursive component has no level
// at which to own something the whole tree shares.
export interface FileTreeNaming {
    parent: string;
    kind: 'folder' | 'document';
}
