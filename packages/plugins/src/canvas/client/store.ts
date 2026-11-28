import { createFlags } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import { defineQuery, retryPolicy } from "@slock/plugins/query/client/api";
import {
  fetchConversationView,
  invalidateConversationView,
} from "@slock/plugins/slack/client/api/conversationView";
import { mentionText } from "@slock/plugins/users/client/api";
import type { CanvasListItem, ChannelId, FileId } from "@slock/types";
import { createStore } from "solid-js";
import {
  CanvasReadError,
  canvasFileTitle,
  fetchCanvas,
  findCanvasFile,
  type LoadedCanvas,
} from "./lib/canvasRequests";

export function createCanvasStore(deps: {
  panes: Pick<Services["shell.panes"], "openInNewPane" | "setPaneContent">;
}) {
  const notVisible = createFlags<FileId>();
  const [remoteChanges, setRemoteChanges] = createStore<Record<FileId, number>>({});

  const titles = defineQuery<FileId, string>({
    gcMs: Number.POSITIVE_INFINITY,
    load: async (fileId) => {
      const file = await findCanvasFile(fileId);
      if (!file) notVisible.set(fileId, true);
      return canvasFileTitle(file) ?? "";
    },
    name: "canvasTitle",
    revalidates: false,
  });

  const canvasesQuery = defineQuery<ChannelId, CanvasListItem[]>({
    load: async (channelId) => {
      const { canvases } = await fetchConversationView(channelId);
      for (const { fileId, title } of canvases)
        if (title && !titles.read(fileId)) titles.set(fileId, title);
      return canvases;
    },
    name: "canvases",
  });

  const canvasesFor = (channelId: ChannelId): CanvasListItem[] =>
    (canvasesQuery.peek(channelId) ?? []).filter((canvas) => !notVisible.has(canvas.fileId));

  function openCanvasPane(fileId: FileId, title?: string) {
    deps.panes.openInNewPane({ fileId, kind: "canvas", title: titles.read(fileId) || title || "" });
  }

  async function fetchVisibleCanvas(fileId: FileId, signal?: AbortSignal): Promise<LoadedCanvas> {
    try {
      const canvas = await fetchCanvas(fileId, signal);
      notVisible.set(fileId, false);
      return canvas;
    } catch (err) {
      if (err instanceof Error && err.message === "not_visible") notVisible.set(fileId, true);
      throw err;
    }
  }

  const canvasContent = defineQuery<FileId, LoadedCanvas>({
    gcMs: 0,
    load: (fileId, { signal }) => fetchVisibleCanvas(fileId, signal),
    name: "canvasContent",
    retry: {
      ...retryPolicy,
      classify: (err) =>
        (err instanceof Error && err.message === "not_visible") || err instanceof CanvasReadError
          ? "stop"
          : (retryPolicy.classify?.(err) ?? "retry"),
    },
  });

  return {
    canvasesFor,
    canvasTitle: (fileId: FileId): string | undefined =>
      mentionText(titles.peek(fileId) ?? "") || undefined,
    rawCanvasTitle: (fileId: FileId): string | undefined => titles.peek(fileId) || undefined,
    createCanvasContentQuery: (fileId: () => FileId) => canvasContent.state(fileId),
    peekCanvasContent: (fileId: FileId) => canvasContent.peek(fileId),
    invalidateChannel(channelId: ChannelId) {
      invalidateConversationView(channelId);
      canvasesQuery.invalidate(channelId);
    },
    refreshCanvasContent: (fileId: FileId) => canvasContent.refresh(fileId).catch(() => undefined),
    isCanvasNotVisible: (fileId: FileId) => notVisible.has(fileId),
    noteRemoteChange: (fileId: FileId) =>
      setRemoteChanges((draft) => {
        draft[fileId] = (draft[fileId] ?? 0) + 1;
      }),
    openCanvasPane,
    remoteChangeTick: (fileId: FileId) => remoteChanges[fileId] ?? 0,
    setCanvasTitle(paneId: string, fileId: FileId, title: string) {
      titles.set(fileId, title);
      deps.panes.setPaneContent(paneId, { fileId, kind: "canvas", title });
    },
  };
}
