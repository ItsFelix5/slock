import type { Services } from "@slock/core/types";
import type { CanvasListItem } from "@slock/types";
import { createSignal, createStore } from "solid-js";
import { defineQuery, retryPolicy } from "../../query/client/api";
import { fetchChannelCanvases } from "../../slack/client/api";
import {
  CanvasReadError,
  fetchCanvas,
  fetchCanvasPermalink,
  fetchCanvasTitleOrVisibility,
  type LoadedCanvas,
} from "./lib/canvasRequests";

export function createCanvasStore(deps: {
  panes: Pick<Services["shell.panes"], "openInNewPane" | "setPaneContent">;
}) {
  const [notVisible, setNotVisible] = createSignal<ReadonlySet<string>>(new Set());
  const [titles, setTitles] = createSignal<Record<string, string>>({});
  const requestedTitles = new Set<string>();
  const [remoteChanges, setRemoteChanges] = createStore<Record<string, number>>({});

  const canvases = defineQuery<string, CanvasListItem[]>({
    load: async (channelId) => {
      const list = await fetchChannelCanvases(channelId);
      seedNamedTitles(list);
      resolvePendingTitles(channelId, list);
      return list;
    },
    name: "canvases",
  });

  function markNotVisible(fileId: string) {
    setNotVisible((current) => new Set(current).add(fileId));
  }

  function canvasTitle(fileId: string): string | undefined {
    if (!requestedTitles.has(fileId)) {
      requestedTitles.add(fileId);
      void fetchCanvasTitleOrVisibility(fileId).then(({ notVisible: hidden, title }) => {
        if (hidden) markNotVisible(fileId);
        if (title) setTitles((current) => ({ ...current, [fileId]: title }));
      });
    }
    return titles()[fileId];
  }

  function seedNamedTitles(canvases: CanvasListItem[]) {
    const named = canvases.filter((canvas) => canvas.title && !titles()[canvas.fileId]);
    for (const { fileId } of named) requestedTitles.add(fileId);
    if (named.length)
      setTitles((current) => ({
        ...Object.fromEntries(named.map((canvas) => [canvas.fileId, canvas.title])),
        ...current,
      }));
  }

  function resolvePendingTitles(channelId: string, canvases: CanvasListItem[]) {
    for (const unresolved of canvases.filter((canvas) => !canvas.title)) {
      void fetchCanvasTitleOrVisibility(unresolved.fileId).then(({ notVisible: hidden, title }) => {
        if (hidden) return markNotVisible(unresolved.fileId);
        if (!title) return;
        canvases.modify(channelId, (items) =>
          items.map((item) => (item.fileId === unresolved.fileId ? { ...item, title } : item)),
        );
      });
    }
  }

  const canvasesFor = (channelId: string): CanvasListItem[] =>
    (canvases.peek(channelId) ?? []).filter((canvas) => !notVisible().has(canvas.fileId));

  function openCanvasPane(fileId: string, title?: string) {
    deps.panes.openInNewPane({ fileId, kind: "canvas", title: title || titles()[fileId] || "" });
  }

  async function fetchVisibleCanvas(fileId: string): Promise<LoadedCanvas> {
    try {
      return await fetchCanvas(fileId);
    } catch (err) {
      if (err instanceof Error && err.message === "not_visible") markNotVisible(fileId);
      throw err;
    }
  }

  const canvasContent = defineQuery<string, LoadedCanvas>({
    gcMs: 0,
    load: fetchVisibleCanvas,
    name: "canvasContent",
    retry: {
      ...retryPolicy,
      classify: (err) =>
        (err instanceof Error && err.message === "not_visible") || err instanceof CanvasReadError
          ? "stop"
          : (retryPolicy.classify?.(err) ?? "retry"),
    },
  });

  const canvasPermalink = defineQuery<string, string | null>({
    load: fetchCanvasPermalink,
    name: "canvasPermalink",
  });

  const createCanvasContentQuery = (fileId: () => string) => canvasContent.state(fileId);
  const createCanvasPermalinkQuery = (fileId: () => string) => canvasPermalink.state(fileId);

  return {
    canvasesFor,
    canvasTitle,
    createCanvasContentQuery,
    createCanvasPermalinkQuery,
    invalidateChannel: canvases.invalidate,
    refreshCanvasContent: (fileId: string) => canvasContent.refresh(fileId).catch(() => undefined),
    isCanvasNotVisible: (fileId: string) => notVisible().has(fileId),
    loadLatestCanvas: (fileId: string) => fetchVisibleCanvas(fileId).catch(() => null),
    noteRemoteChange: (fileId: string) => setRemoteChanges(fileId, (n) => (n ?? 0) + 1),
    openCanvasPane,
    remoteChangeTick: (fileId: string) => remoteChanges[fileId] ?? 0,
    setCanvasContent: (fileId: string, content: LoadedCanvas) => canvasContent.set(fileId, content),
    setCanvasTitle(paneId: string, fileId: string, title: string) {
      setTitles((current) => ({ ...current, [fileId]: title }));
      deps.panes.setPaneContent(paneId, { fileId, kind: "canvas", title });
    },
  };
}
