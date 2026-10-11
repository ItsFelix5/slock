import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { createEffect, untrack } from "solid-js";
import { createConversations } from "./conversations";

const setup: Setup = (ctx) => {
  const shell = service("shell.view");
  const panes = service("shell.panes");
  const conversations = createConversations({
    kinds: ctx.use("conversations.kind"),
    opened: ctx.use("conversations.opened"),
  });
  ctx.provide("conversations", conversations);

  createEffect(() => {
    if (!shell.ready()) return;
    for (const pane of panes.panes()) {
      const { content } = pane;
      if (content?.kind !== "channel" && content?.kind !== "dm") continue;
      const kind = conversations.kindOf(content.id);
      if (kind !== content.kind) panes.setPaneContent(pane.id, { id: content.id, kind });
    }
  });

  createEffect(() => {
    const open = new Set(panes.panes().map((pane) => pane.id));
    for (const id of untrack(conversations.targetPaneIds))
      if (!open.has(id)) conversations.clearMessageTarget(id);
  });
};

export default setup;
