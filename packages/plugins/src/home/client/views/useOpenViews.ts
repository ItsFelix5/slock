import { service } from "@slock/core/solid";
import type { ChannelId } from "@slock/types";
import { createMemo } from "solid-js";

export function useOpenViews() {
  const panes = service("conversations");
  const openKeys = createMemo(
    () => new Set(panes.visibleViews().map((view) => `${view.kind}:${view.id}`)),
  );
  return (id: ChannelId, kind: "channel" | "dm") => openKeys().has(`${kind}:${id}`);
}
