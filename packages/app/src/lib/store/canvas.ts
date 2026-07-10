import type { CanvasInfo } from "@slock/slack-api";
import {
  createChannelCanvas,
  fetchCanvas,
  fetchChannelCanvasInfo,
  saveCanvas,
} from "@slock/slack-api";
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { actionFeedback } from "./feedback";

export function createCanvasSlice() {
  const [canvasByChannel, setCanvasByChannel] = createStore<Record<string, CanvasInfo | null>>({});
  const [openCanvasChannelId, setOpenCanvasChannelId] = createSignal<string | null>(null);

  async function ensureCanvasChecked(channelId: string) {
    if (channelId in canvasByChannel) return;
    try {
      setCanvasByChannel(channelId, await fetchChannelCanvasInfo(channelId));
    } catch {
      setCanvasByChannel(channelId, null);
    }
  }

  function openChannelCanvas(channelId: string) {
    setOpenCanvasChannelId(channelId);
  }

  function closeChannelCanvas() {
    setOpenCanvasChannelId(null);
  }

  async function createCanvasForCurrentChannel(channelId: string) {
    const fileId = await createChannelCanvas(channelId);
    if (!fileId) {
      actionFeedback.flash(channelId, "Failed to create canvas.", "error");
      return;
    }
    setCanvasByChannel(channelId, { fileId, isEmpty: true });
  }

  async function loadCanvasContent(fileId: string): Promise<string> {
    return (await fetchCanvas(fileId)) ?? "";
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
    ensureCanvasChecked,
    openCanvasChannelId,
    openChannelCanvas,
    closeChannelCanvas,
    createCanvasForCurrentChannel,
    loadCanvasContent,
    saveChannelCanvas,
  };
}
