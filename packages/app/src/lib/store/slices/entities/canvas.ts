import type { CanvasInfo, CanvasListItem } from "@slock/slack-api";
import {
  createChannelCanvas as createChannelCanvasApi,
  createSharedChannelCanvas,
  fetchCanvas,
  fetchCanvasFileUrl,
  fetchCanvasTitle,
  fetchChannelCanvases,
  fetchChannelCanvasInfo,
  saveCanvas,
} from "@slock/slack-api";
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { actionFeedback } from "../feedback";

// A canvas can be opened two ways: the channel's own canvas (from the header
// button — title is the channel name, content tracked in canvasByChannel),
// or a standalone canvas shared as a file attachment in some message (title
// is just the file's own name, and it isn't any channel's canvas property).
// Both end up in the same CanvasPanel, driven by the same loadCanvasContent/
// saveChannelCanvas below since those already only need a bare fileId.
export type OpenCanvas =
  | { kind: "channel"; channelId: string }
  | { kind: "create"; channelId: string }
  | { kind: "file"; fileId: string; title: string };

export function createCanvasSlice() {
  const [canvasByChannel, setCanvasByChannel] = createStore<Record<string, CanvasInfo | null>>({});
  const [canvasesByChannel, setCanvasesByChannel] = createStore<Record<string, CanvasListItem[]>>(
    {},
  );
  const [canvasCheckErrorByChannel, setCanvasCheckErrorByChannel] = createStore<
    Record<string, boolean>
  >({});
  const [canvasCheckingByChannel, setCanvasCheckingByChannel] = createStore<
    Record<string, boolean>
  >({});
  const [canvasCreatingByChannel, setCanvasCreatingByChannel] = createStore<
    Record<string, boolean>
  >({});
  const [openCanvas, setOpenCanvas] = createSignal<OpenCanvas | null>(null);
  const canvasChecks = new Map<string, Promise<void>>();

  function cacheChannelCanvases(channelId: string, canvases: CanvasListItem[]): void {
    const normalized = canvases.map((canvas) => ({
      ...canvas,
      title: canvas.title || "Untitled canvas",
    }));
    setCanvasesByChannel(channelId, normalized);
    const [canvas] = normalized;
    setCanvasByChannel(channelId, canvas ? { fileId: canvas.fileId, isEmpty: false } : null);
    for (const unresolved of canvases.filter((canvas) => !canvas.title)) {
      void fetchCanvasTitle(unresolved.fileId).then((title) => {
        if (!title) return;
        setCanvasesByChannel(channelId, (items = []) =>
          items.map((item) =>
            item.fileId === unresolved.fileId && item.title === "Untitled canvas"
              ? { ...item, title }
              : item,
          ),
        );
      });
    }
  }

  function ensureCanvasChecked(channelId: string): Promise<void> {
    if (channelId in canvasByChannel) return Promise.resolve();
    const existing = canvasChecks.get(channelId);
    if (existing) return existing;

    setCanvasCheckingByChannel(channelId, true);
    setCanvasCheckErrorByChannel(channelId, false);
    const request = fetchChannelCanvases(channelId)
      .then((canvases) => cacheChannelCanvases(channelId, canvases))
      .catch((err) => {
        // Leave the channel unchecked so opening its menu or returning to it can
        // retry. Caching a transport/API failure as null permanently hides a
        // canvas that may exist.
        console.error("Failed to check for channel canvas", err);
        setCanvasCheckErrorByChannel(channelId, true);
        actionFeedback.flash(channelId, "Couldn’t check for a channel canvas.", "error");
      })
      .finally(() => {
        canvasChecks.delete(channelId);
        setCanvasCheckingByChannel(channelId, false);
      });
    canvasChecks.set(channelId, request);
    return request;
  }

  function openChannelCanvas(channelId: string) {
    setOpenCanvas({ channelId, kind: "channel" });
  }

  function openCanvasCreator(channelId: string) {
    setOpenCanvas({ channelId, kind: "create" });
  }

  function openFileCanvas(fileId: string, title: string) {
    setOpenCanvas({ fileId, kind: "file", title });
  }

  function closeCanvas() {
    setOpenCanvas(null);
  }

  async function createCanvas(channelId: string, title: string): Promise<boolean> {
    if (canvasCreatingByChannel[channelId]) return false;
    const existing = canvasByChannel[channelId];

    setCanvasCreatingByChannel(channelId, true);
    actionFeedback.clear(channelId);
    try {
      if (existing) {
        const canvas = await createSharedChannelCanvas(channelId, title);
        setCanvasesByChannel(channelId, (items = []) => [...items, canvas]);
        setOpenCanvas({ fileId: canvas.fileId, kind: "file", title: canvas.title });
      } else {
        const canvas = await createChannelCanvasApi(channelId, title);
        setCanvasByChannel(channelId, canvas);
        setCanvasesByChannel(channelId, [{ fileId: canvas.fileId, title }]);
        setOpenCanvas({ channelId, kind: "channel" });
      }
      setCanvasCheckErrorByChannel(channelId, false);
      return true;
    } catch (err) {
      // If another client created the channel canvas after our last check,
      // Slack rejects the duplicate create. Refresh once so that race still
      // lands the user in the canvas that now exists.
      if (!existing) {
        try {
          const canvas = await fetchChannelCanvasInfo(channelId);
          if (canvas) {
            setCanvasByChannel(channelId, canvas);
            setCanvasesByChannel(channelId, [{ fileId: canvas.fileId, title }]);
            setCanvasCheckErrorByChannel(channelId, false);
            setOpenCanvas({ channelId, kind: "channel" });
            return true;
          }
        } catch {
          // Report the original create failure below; it is the useful action.
        }
      }
      console.error("Failed to add canvas", err);
      actionFeedback.flash(channelId, "Couldn’t add the canvas.", "error");
      return false;
    } finally {
      setCanvasCreatingByChannel(channelId, false);
    }
  }

  async function loadCanvasContent(fileId: string): Promise<string | null> {
    try {
      return (await fetchCanvas(fileId)) ?? "";
    } catch (err) {
      console.error("Failed to load canvas", err);
      actionFeedback.flash(fileId, "Failed to load canvas.", "error");
      return null;
    }
  }

  // A real, navigable URI to the canvas's own backing file (open in a new
  // tab, copy link, etc.) — not just the in-app rich editor.
  function loadCanvasFileUrl(fileId: string): Promise<string | null> {
    return fetchCanvasFileUrl(fileId);
  }

  async function saveChannelCanvas(fileId: string, markdown: string): Promise<boolean> {
    try {
      await saveCanvas(fileId, markdown);
      return true;
    } catch (err) {
      console.error("Failed to save canvas", err);
      actionFeedback.flash(fileId, "Failed to save canvas.", "error");
      return false;
    }
  }

  return {
    canvasByChannel,
    canvasesByChannel,
    canvasCheckErrorByChannel,
    canvasCheckingByChannel,
    canvasCreatingByChannel,
    closeCanvas,
    cacheChannelCanvases,
    createCanvas,
    ensureCanvasChecked,
    loadCanvasContent,
    loadCanvasFileUrl,
    openCanvas,
    openCanvasCreator,
    openChannelCanvas,
    openFileCanvas,
    saveChannelCanvas,
  };
}
