import { store } from "./store";

export function closeTile(paneId: string) {
  const pane = store.panes.panes().find((p) => p.id === paneId);
  if (pane?.content?.kind === "thread") {
    store.realtime.send({ ts: pane.content.ts, type: "unwatch_thread" });
  }
  store.panes.closePane(paneId);
}
