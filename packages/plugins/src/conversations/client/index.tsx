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

  createEffect(
    () => {
      if (!shell.ready()) return [];
      return panes.panes().flatMap((pane) => {
        const { content } = pane;
        if (content?.kind !== "channel" && content?.kind !== "dm") return [];
        const kind = conversations.kindOf(content.id);
        return kind === content.kind ? [] : [{ content: { id: content.id, kind }, id: pane.id }];
      });
    },
    (fixes) => {
      for (const fix of fixes) panes.setPaneContent(fix.id, fix.content);
    },
  );

  createEffect(
    () => new Set(panes.panes().map((pane) => pane.id)),
    (open) => {
      for (const id of untrack(conversations.targetPaneIds))
        if (!open.has(id)) conversations.clearMessageTarget(id);
    },
  );
};

export default setup;
