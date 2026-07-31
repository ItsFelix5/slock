/**
 * Tracks which canvas has populated the currently mounted editor DOM node.
 * Closing the panel unmounts that node, so an absent file id resets the
 * tracker even when the next canvas opened happens to be the same file.
 */
export function createCanvasEditorLoadTracker() {
  let loadedFileId: string | undefined;

  function shouldLoad(fileId: string | undefined, contentReady: boolean): boolean {
    if (!fileId) {
      loadedFileId = undefined;
      return false;
    }
    if (!contentReady || fileId === loadedFileId) return false;
    loadedFileId = fileId;
    return true;
  }

  return { shouldLoad };
}
