// What the app reaches for. Deliberately narrower than what the modules export:
// `writeConfig`, `folderExists`, `takenFolderNames` and `SCAN_DEPTH` are used
// inside their own module, or by the OPFS suites, which import them from
// `./config` and `./documents` directly.
export { readConfig, refreshConfig, updateConfig } from './config';
export {
    createDocument,
    createFolder,
    deleteDocument,
    deleteFolder,
    DocumentError,
    type DocumentLocation,
    ensureSubfolder,
    findDocument,
    folderIsReachable,
    type FolderNode,
    type OpenedDocument,
    readDocument,
    renameDocument,
    scanFolder,
    SUGGESTED_FOLDER_NAME,
    suggestUntitledName,
    writeDocument,
    type WriteDocumentOptions,
    writeImage
} from './documents';
export {
    clearDirectoryHandle,
    ensurePermission,
    loadDirectoryHandle,
    saveDirectoryHandle
} from './handle-store';
export { isFileSystemAccessSupported } from './support';
