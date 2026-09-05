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

// The one inline naming row the tree may have open.
//
// Held by the screen rather than by the tree, exactly as expansion state is —
// there is only ever one of these open, and a recursive component has no level
// at which to own something the whole tree shares.
//
// Two shapes, because naming a new thing and renaming an existing one are the
// same input in two different places: a `create` row is drawn at the top of the
// folder it will land in, a `rename` row replaces the document's own row.
export type FileTreeNaming =
    | {
          mode: 'create';
          // The folder the new thing lands in. '' is the working folder itself.
          parent: string;
          kind: 'folder' | 'document';
      }
    | {
          mode: 'rename';
          entry: DocumentIndexEntry;
      };
