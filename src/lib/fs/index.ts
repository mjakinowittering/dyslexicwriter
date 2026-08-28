export { readConfig, updateConfig, writeConfig } from './config';
export {
    deleteDocument,
    DocumentError,
    type DocumentLocation,
    ensureSubfolder,
    findDocument,
    flattenDocuments,
    folderExists,
    folderIsReachable,
    type FolderNode,
    type OpenedDocument,
    readDocument,
    renameDocument,
    SCAN_DEPTH,
    scanFolder,
    SUGGESTED_FOLDER_NAME,
    suggestUntitledName,
    takenFolderNames,
    writeDocument,
    writeImage
} from './documents';
export {
    clearDirectoryHandle,
    ensurePermission,
    loadDirectoryHandle,
    saveDirectoryHandle
} from './handle-store';
export { isFileSystemAccessSupported } from './support';
