import type { CanvasBlock } from "@slock/types";
import { createReactiveQueryCache } from "../../../reactiveQueryCache";
import { queryOptions } from "@tanstack/solid-query";
import type { CanvasListItem } from "../../../api";
import {
  fetchCanvas,
  fetchCanvasFileUrl,
  fetchCanvasPermalink,
  fetchCanvasTitle,
  fetchChannelCanvases,
} from "../../../api";
import { queryClient } from "../../../queryClient";
import type { createPanesSlice } from "../session/panes";
import type { PaneContent } from "../types";

export function canvasesQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: ["canvases", channelId],
    queryFn: async () => {
      const canvases = await fetchChannelCanvases(channelId);
      resolvePendingTitles(channelId, canvases);
      return canvases;
    },
  });
}

function resolvePendingTitles(channelId: string, canvases: CanvasListItem[]): void {
  for (const unresolved of canvases.filter((canvas) => !canvas.title)) {
    void fetchCanvasTitle(unresolved.fileId).then((title) => {
      if (!title) return;
      queryClient.setQueryData(
        ["canvases", channelId],
        (items: CanvasListItem[] | undefined = []) =>
          items.map((item) => (item.fileId === unresolved.fileId ? { ...item, title } : item)),
      );
    });
  }
}

export function resolveCanvasPaneTitle(
  paneId: string,
  fileId: string,
  setPaneContent: (id: string, content: PaneContent | null) => void,
): void {
  void fetchCanvasTitle(fileId).then((title) => {
    if (title) setPaneContent(paneId, { fileId, kind: "canvas", title });
  });
}

export function createCanvasSlice(deps: {
  panes: Pick<ReturnType<typeof createPanesSlice>, "openInNewPane" | "setPaneContent">;
}) {
  const canvases = createReactiveQueryCache<CanvasListItem[]>(
    queryClient,
    "canvases",
    canvasesQueryOptions,
  );

  function canvasesFor(channelId: string): CanvasListItem[] {
    return canvases.entry(channelId) ?? [];
  }

  function handleCanvasCreated(channelId: string): void {
    canvases.invalidate(channelId);
  }

  function openCanvasPane(fileId: string, title?: string): void {
    const id = deps.panes.openInNewPane({ fileId, kind: "canvas", title: title ?? "" });
    if (title) return;
    resolveCanvasPaneTitle(id, fileId, deps.panes.setPaneContent);
  }

  async function loadCanvasContent(fileId: string): Promise<CanvasBlock[] | null> {
    try {
      return await fetchCanvas(fileId);
    } catch (err) {
      console.error("Failed to load canvas", err);
      return null;
    }
  }

  function loadCanvasFileUrl(fileId: string): Promise<string | null> {
    return fetchCanvasFileUrl(fileId);
  }

  function loadCanvasPermalink(fileId: string): Promise<string | null> {
    return fetchCanvasPermalink(fileId);
  }

  return {
    canvasesFor,
    handleCanvasCreated,
    loadCanvasContent,
    loadCanvasFileUrl,
    loadCanvasPermalink,
    openCanvasPane,
  };
}
