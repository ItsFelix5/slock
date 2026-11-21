import type { Services } from "@slock/core/types";
import { defineQuery, retryPolicy } from "@slock/plugins/query/client/api";
import { fetchChannelCanvases } from "@slock/plugins/slack/client/api";
import type { CanvasListItem, ChannelId, FileId } from "@slock/types";
import { createSignal, createStore } from "solid-js";
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
  const [notVisible, setNotVisible] = createSignal<ReadonlySet<FileId>>(new Set());
  const [titles, setTitles] = createSignal<Record<FileId, string>>({});
  const requestedTitles = new Set<FileId>();
  const [remoteChanges, setRemoteChanges] = createStore<Record<FileId, number>>({});

  const canvasesQuery = defineQuery<ChannelId, CanvasListItem[]>({
    load: async (channelId) => {
      const list = await fetchChannelCanvases(channelId);
      seedNamedTitles(list);
      resolvePendingTitles(channelId, list);
      return list;
    },
    name: "canvases",
  });

  function markNotVisible(fileId: FileId) {
    setNotVisible((current) => new Set(current).add(fileId));
  }

  function canvasTitle(fileId: FileId): string | undefined {
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

  function resolvePendingTitles(channelId: ChannelId, canvases: CanvasListItem[]) {
    for (const unresolved of canvases.filter((canvas) => !canvas.title)) {
      void fetchCanvasTitleOrVisibility(unresolved.fileId).then(({ notVisible: hidden, title }) => {
        if (hidden) return markNotVisible(unresolved.fileId);
        if (!title) return;
        canvasesQuery.modify(channelId, (items) =>
          items.map((item) => (item.fileId === unresolved.fileId ? { ...item, title } : item)),
        );
      });
    }
  }

  const canvasesFor = (channelId: ChannelId): CanvasListItem[] =>
    (canvasesQuery.peek(channelId) ?? []).filter((canvas) => !notVisible().has(canvas.fileId));

  function openCanvasPane(fileId: FileId, title?: string) {
    deps.panes.openInNewPane({ fileId, kind: "canvas", title: title || titles()[fileId] || "" });
  }

  async function fetchVisibleCanvas(fileId: FileId): Promise<LoadedCanvas> {
    try {
      return await fetchCanvas(fileId);
    } catch (err) {
      if (err instanceof Error && err.message === "not_visible") markNotVisible(fileId);
      throw err;
    }
  }

  const canvasContent = defineQuery<FileId, LoadedCanvas>({
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

  const canvasPermalink = defineQuery<FileId, string | null>({
    load: fetchCanvasPermalink,
    name: "canvasPermalink",
  });

  const createCanvasContentQuery = (fileId: () => FileId) => canvasContent.state(fileId);
  const createCanvasPermalinkQuery = (fileId: () => FileId) => canvasPermalink.state(fileId);

  return {
    canvasesFor,
    canvasTitle,
    createCanvasContentQuery,
    createCanvasPermalinkQuery,
    invalidateChannel: canvasesQuery.invalidate,
    refreshCanvasContent: (fileId: FileId) => canvasContent.refresh(fileId).catch(() => undefined),
    isCanvasNotVisible: (fileId: FileId) => notVisible().has(fileId),
    loadLatestCanvas: (fileId: FileId) => fetchVisibleCanvas(fileId).catch(() => null),
    noteRemoteChange: (fileId: FileId) =>
      setRemoteChanges((draft) => {
        draft[fileId] = (draft[fileId] ?? 0) + 1;
      }),
    openCanvasPane,
    remoteChangeTick: (fileId: FileId) => remoteChanges[fileId] ?? 0,
    setCanvasContent: (fileId: FileId, content: LoadedCanvas) => canvasContent.set(fileId, content),
    setCanvasTitle(paneId: string, fileId: FileId, title: string) {
      setTitles((current) => ({ ...current, [fileId]: title }));
      deps.panes.setPaneContent(paneId, { fileId, kind: "canvas", title });
    },
  };
}
