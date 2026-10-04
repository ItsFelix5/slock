import type { CanvasBlock, CanvasListItem } from "@slock/types";
import { queryOptions } from "@tanstack/solid-query";
import { createSignal } from "solid-js";
import {
  fetchCanvas,
  fetchCanvasFileUrl,
  fetchCanvasPermalink,
  fetchCanvasTitle,
  fetchCanvasTitleOrVisibility,
  fetchChannelCanvases,
} from "../../../api";
import { queryClient } from "../../../queryClient";
import { createReactiveQueryCache } from "../../../reactiveQueryCache";
import type { createPanesSlice } from "../session/panes";
import type { PaneContent } from "../types";

const notVisibleFileIds = new Set<string>();
const [notVisibleVersion, setNotVisibleVersion] = createSignal(0);

function markCanvasNotVisible(fileId: string): void {
  if (notVisibleFileIds.has(fileId)) return;
  notVisibleFileIds.add(fileId);
  setNotVisibleVersion((v) => v + 1);
}

function isCanvasNotVisible(fileId: string): boolean {
  notVisibleVersion();
  return notVisibleFileIds.has(fileId);
}

const [canvasTitles, setCanvasTitles] = createSignal<Record<string, string>>({});
const requestedTitles = new Set<string>();

function canvasTitle(fileId: string): string | undefined {
  if (!requestedTitles.has(fileId)) {
    requestedTitles.add(fileId);
    void fetchCanvasTitleOrVisibility(fileId).then(({ notVisible, title }) => {
      if (notVisible) markCanvasNotVisible(fileId);
      if (title) setCanvasTitles((titles) => ({ ...titles, [fileId]: title }));
    });
  }
  return canvasTitles()[fileId];
}

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
    void fetchCanvasTitleOrVisibility(unresolved.fileId).then(({ notVisible, title }) => {
      if (notVisible) return markCanvasNotVisible(unresolved.fileId);
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
    notVisibleVersion();
    return (canvases.entry(channelId) ?? []).filter(
      (canvas) => !notVisibleFileIds.has(canvas.fileId),
    );
  }

  function handleCanvasCreated(channelId: string): void {
    canvases.invalidate(channelId);
  }

  function openCanvasPane(fileId: string, title?: string): void {
    title ||= canvasTitles()[fileId];
    const id = deps.panes.openInNewPane({ fileId, kind: "canvas", title: title ?? "" });
    if (title) return;
    resolveCanvasPaneTitle(id, fileId, deps.panes.setPaneContent);
  }

  async function loadCanvasContent(fileId: string): Promise<CanvasBlock[] | null> {
    try {
      return await fetchCanvas(fileId);
    } catch (err) {
      if (err instanceof Error && err.message === "not_visible") markCanvasNotVisible(fileId);
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
    canvasTitle,
    handleCanvasCreated,
    isCanvasNotVisible,
    loadCanvasContent,
    loadCanvasFileUrl,
    loadCanvasPermalink,
    openCanvasPane,
  };
}
