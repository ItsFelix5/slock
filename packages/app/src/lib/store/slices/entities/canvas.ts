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

  async function ensureCanvasChecked(channelId: string) {
    if (channelId in canvasByChannel) return;
    try {
      setCanvasByChannel(channelId, await fetchChannelCanvasInfo(channelId));
    } catch {
      setCanvasByChannel(channelId, null);
    }
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

  async function loadCanvasContent(fileId: string): Promise<string> {
    return (await fetchCanvas(fileId)) ?? "";
  }

  // A real, navigable URI to the canvas's own backing file (open in a new
  // tab, copy link, etc.) — not just the in-app rich editor.
  function loadCanvasFileUrl(fileId: string): Promise<string | null> {
    return fetchCanvasFileUrl(fileId);
  }

  async function saveChannelCanvas(fileId: string, markdown: string) {
    try {
      await saveCanvas(fileId, markdown);
    } catch (err) {
      console.error("Failed to save canvas", err);
      actionFeedback.flash(fileId, "Failed to save canvas.", "error");
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
