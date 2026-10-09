import type { CanvasListItem } from "@slock/types";
import { createQuery, queryOptions } from "@tanstack/solid-query";
import { createSignal } from "solid-js";
import {
  fetchCanvas,
  fetchCanvasPermalink,
  fetchCanvasTitle,
  fetchCanvasTitleOrVisibility,
  fetchChannelCanvases,
  type LoadedCanvas,
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

export function canvasTitle(fileId: string): string | undefined {
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

  async function fetchVisibleCanvas(fileId: string): Promise<LoadedCanvas> {
    try {
      return await fetchCanvas(fileId);
    } catch (err) {
      if (err instanceof Error && err.message === "not_visible") markCanvasNotVisible(fileId);
      throw err;
    }
  }

  function loadLatestCanvas(fileId: string): Promise<LoadedCanvas | null> {
    return fetchVisibleCanvas(fileId).catch(() => null);
  }

  function createCanvasContentQuery(fileId: () => string) {
    return createQuery(
      () => ({
        gcTime: 0,
        queryFn: () => fetchVisibleCanvas(fileId()),
        queryKey: ["canvasContent", fileId()],
        retry: (_, err) => !(err instanceof Error && err.message === "not_visible"),
      }),
      () => queryClient,
    );
  }

  function setCanvasContent(fileId: string, content: LoadedCanvas): void {
    queryClient.setQueryData(["canvasContent", fileId], content);
  }

  function setCanvasTitle(paneId: string, fileId: string, title: string): void {
    setCanvasTitles((titles) => ({ ...titles, [fileId]: title }));
    deps.panes.setPaneContent(paneId, { fileId, kind: "canvas", title });
  }

  function createCanvasPermalinkQuery(fileId: () => string) {
    return createQuery(
      () => ({
        queryFn: () => fetchCanvasPermalink(fileId()),
        queryKey: ["canvasPermalink", fileId()],
      }),
      () => queryClient,
    );
  }

  return {
    canvasesFor,
    canvasTitle,
    handleCanvasCreated,
    isCanvasNotVisible,
    createCanvasContentQuery,
    createCanvasPermalinkQuery,
    loadLatestCanvas,
    openCanvasPane,
    setCanvasContent,
    setCanvasTitle,
  };
}
