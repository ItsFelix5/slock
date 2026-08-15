import type { CanvasListItem } from "@slock/slack-api";
import {
  fetchCanvas,
  fetchCanvasFileUrl,
  fetchCanvasTitle,
  fetchChannelCanvases,
} from "@slock/slack-api";
import { createStore } from "solid-js/store";
import type { createPanesSlice } from "../session/panes";

// Read-only for now: viewing/listing a channel's canvases, not creating or editing one.
export function createCanvasSlice(deps: {
  panes: Pick<ReturnType<typeof createPanesSlice>, "openInNewPane">;
}) {
  const [canvasesByChannel, setCanvasesByChannel] = createStore<Record<string, CanvasListItem[]>>(
    {},
  );
  const [canvasCheckingByChannel, setCanvasCheckingByChannel] = createStore<
    Record<string, boolean>
  >({});
  const [canvasCheckErrorByChannel, setCanvasCheckErrorByChannel] = createStore<
    Record<string, boolean>
  >({});
  const canvasChecks = new Map<string, Promise<void>>();

  function cacheChannelCanvases(channelId: string, canvases: CanvasListItem[]): void {
    const normalized = canvases.map((canvas) => ({
      ...canvas,
      title: canvas.title || "Untitled canvas",
    }));
    setCanvasesByChannel(channelId, normalized);
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
    if (channelId in canvasesByChannel) return Promise.resolve();
    const existing = canvasChecks.get(channelId);
    if (existing) return existing;

    setCanvasCheckingByChannel(channelId, true);
    setCanvasCheckErrorByChannel(channelId, false);
    const request = fetchChannelCanvases(channelId)
      .then((canvases) => cacheChannelCanvases(channelId, canvases))
      .catch((err) => {
        console.error("Failed to check for channel canvas", err);
        setCanvasCheckErrorByChannel(channelId, true);
      })
      .finally(() => {
        canvasChecks.delete(channelId);
        setCanvasCheckingByChannel(channelId, false);
      });
    canvasChecks.set(channelId, request);
    return request;
  }

  function openCanvasPane(fileId: string, title: string): void {
    deps.panes.openInNewPane({ fileId, kind: "canvas", title });
  }

  async function loadCanvasContent(fileId: string): Promise<string | null> {
    try {
      return (await fetchCanvas(fileId)) ?? "";
    } catch (err) {
      console.error("Failed to load canvas", err);
      return null;
    }
  }

  function loadCanvasFileUrl(fileId: string): Promise<string | null> {
    return fetchCanvasFileUrl(fileId);
  }

  return {
    canvasCheckErrorByChannel,
    canvasCheckingByChannel,
    canvasesByChannel,
    ensureCanvasChecked,
    loadCanvasContent,
    loadCanvasFileUrl,
    openCanvasPane,
  };
}
