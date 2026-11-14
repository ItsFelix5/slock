import { service } from "@slock/core/solid";
import { createMemo } from "solid-js";

export function useOpenViews() {
  const panes = service("conversations");
  const openKeys = createMemo(
    () => new Set(panes.visibleViews().map((view) => `${view.kind}:${view.id}`)),
  );
  return (id: string, kind: "channel" | "dm") => openKeys().has(`${kind}:${id}`);
}
