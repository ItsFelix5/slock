import type { Setup } from "@slock/core";
import { lazy } from "solid-js";
import { createFilesLinksPanel } from "./store";
import FilesLinksButton from "./views/FilesLinksButton";

const FilesLinksTakeover = lazy(() => import("./views/FilesLinksTakeover"));

const setup: Setup = (ctx) => {
  const panel = createFilesLinksPanel();
  ctx.provide("files-panel", panel);
  ctx.onCleanup(panel.closeFilesLinksPanel);
  ctx.add("realtime.reconnect", panel.retryFilesLinks);
  ctx.add("conversations.opened", panel.closeFilesLinksPanel);
  ctx.add("composer.editor", (quill, editor) => {
    const closeOnTyping = (_delta: unknown, _old: unknown, source: string) => {
      if (source === "user" && panel.filesLinksChannelId() === editor.props?.channelId)
        panel.closeFilesLinksPanel();
    };
    quill.on("text-change", closeOnTyping);
    return () => quill.off("text-change", closeOnTyping);
  });
  ctx.add("messages.header", FilesLinksButton, { order: 100 });
  ctx.add("messages.takeover", {
    active: (view) => panel.filesLinksChannelId() === view.id,
    view: FilesLinksTakeover,
  });
};

export default setup;
