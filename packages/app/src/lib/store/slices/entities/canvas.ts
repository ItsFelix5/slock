import type { CanvasInfo } from "@slock/slack-api";
import {
  fetchCanvas,
  fetchCanvasFileUrl,
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
  | { kind: "file"; fileId: string; title: string };

export function createCanvasSlice() {
  const [canvasByChannel, setCanvasByChannel] = createStore<Record<string, CanvasInfo | null>>({});
  const [openCanvas, setOpenCanvas] = createSignal<OpenCanvas | null>(null);
  const canvasChecks = new Map<string, Promise<void>>();

  function ensureCanvasChecked(channelId: string): Promise<void> {
    if (channelId in canvasByChannel) return Promise.resolve();
    const existing = canvasChecks.get(channelId);
    if (existing) return existing;

    const request = fetchChannelCanvasInfo(channelId)
      .then((canvas) => setCanvasByChannel(channelId, canvas))
      .catch((err) => {
        // Leave the channel unchecked so opening its menu or returning to it can
        // retry. Caching a transport/API failure as null permanently hides a
        // canvas that may exist.
        console.error("Failed to check for channel canvas", err);
        actionFeedback.flash(channelId, "Couldn’t check for a channel canvas.", "error");
      })
      .finally(() => canvasChecks.delete(channelId));
    canvasChecks.set(channelId, request);
    return request;
  }

  function openChannelCanvas(channelId: string) {
    setOpenCanvas({ channelId, kind: "channel" });
  }

  function openFileCanvas(fileId: string, title: string) {
    setOpenCanvas({ fileId, kind: "file", title });
  }

  function closeCanvas() {
    setOpenCanvas(null);
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
    closeCanvas,
    ensureCanvasChecked,
    loadCanvasContent,
    loadCanvasFileUrl,
    openCanvas,
    openChannelCanvas,
    openFileCanvas,
    saveChannelCanvas,
  };
}
