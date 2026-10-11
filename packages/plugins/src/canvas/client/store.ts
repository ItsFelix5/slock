import { service } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import type { CanvasListItem } from "@slock/types";
import { createQuery, queryOptions } from "@tanstack/solid-query";
import { createSignal } from "solid-js";
import { createReactiveQueryCache, defineKey } from "../../query/client/api";
import { fetchChannelCanvases } from "../../slack/client/api";
import {
  fetchCanvas,
  fetchCanvasPermalink,
  fetchCanvasTitleOrVisibility,
  type LoadedCanvas,
} from "./lib/canvasRequests";

const canvasesKey = defineKey<[string]>("canvases");
const canvasContentKey = defineKey<[string]>("canvasContent");
const canvasPermalinkKey = defineKey<[string]>("canvasPermalink");

const query = service("query");

export function createCanvasStore(deps: {
  panes: Pick<Services["shell.panes"], "openInNewPane" | "setPaneContent">;
}) {
  const [notVisible, setNotVisible] = createSignal<ReadonlySet<string>>(new Set());
  const [titles, setTitles] = createSignal<Record<string, string>>({});
  const requestedTitles = new Set<string>();

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
        query.client.setQueryData(
          canvasesKey(channelId),
          (items: CanvasListItem[] | undefined = []) =>
            items.map((item) => (item.fileId === unresolved.fileId ? { ...item, title } : item)),
        );
      });
    }
  }

  const canvases = createReactiveQueryCache(query.client, "canvases", (channelId) =>
    queryOptions({
      queryKey: canvasesKey(channelId),
      queryFn: async () => {
        const list = await fetchChannelCanvases(channelId);
        seedNamedTitles(list);
        resolvePendingTitles(channelId, list);
        return list;
      },
    }),
  );

  const canvasesFor = (channelId: string): CanvasListItem[] =>
    (canvases.entry(channelId) ?? []).filter((canvas) => !notVisible().has(canvas.fileId));

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

  function createCanvasContentQuery(fileId: () => string) {
    return createQuery(
      () => ({
        gcTime: 0,
        queryFn: () => fetchVisibleCanvas(fileId()),
        queryKey: canvasContentKey(fileId()),
        retry: (_, err) => !(err instanceof Error && err.message === "not_visible"),
      }),
      () => query.client,
    );
  }

  function createCanvasPermalinkQuery(fileId: () => string) {
    return createQuery(
      () => ({
        queryFn: () => fetchCanvasPermalink(fileId()),
        queryKey: canvasPermalinkKey(fileId()),
      }),
      () => query.client,
    );
  }

  return {
    canvasesFor,
    canvasTitle,
    createCanvasContentQuery,
    createCanvasPermalinkQuery,
    invalidateChannel: canvases.invalidate,
    isCanvasNotVisible: (fileId: string) => notVisible().has(fileId),
    loadLatestCanvas: (fileId: string) => fetchVisibleCanvas(fileId).catch(() => null),
    openCanvasPane,
    setCanvasContent: (fileId: string, content: LoadedCanvas) =>
      query.client.setQueryData(canvasContentKey(fileId), content),
    setCanvasTitle(paneId: string, fileId: string, title: string) {
      setTitles((current) => ({ ...current, [fileId]: title }));
      deps.panes.setPaneContent(paneId, { fileId, kind: "canvas", title });
    },
  };
}
