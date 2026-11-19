import type { ChannelId, Ts } from "@slock/types";
import { createSignal, createStore, onCleanup } from "solid-js";

export type ViewKey = ChannelId | Ts;

const isWindowActive = () => document.hasFocus() && document.visibilityState === "visible";

export function createViewState() {
  const [bottomSeen, setBottomSeenStore] = createStore<Record<string, boolean>>({});
  const [windowActive, setWindowActive] = createSignal(isWindowActive());
  const syncWindowActive = () => setWindowActive(isWindowActive());
  window.addEventListener("focus", syncWindowActive);
  window.addEventListener("blur", syncWindowActive);
  document.addEventListener("visibilitychange", syncWindowActive);
  onCleanup(() => {
    window.removeEventListener("focus", syncWindowActive);
    window.removeEventListener("blur", syncWindowActive);
    document.removeEventListener("visibilitychange", syncWindowActive);
  });

  return {
    isViewed: (id: ViewKey) => windowActive() && !!bottomSeen[id],
    setBottomSeen(id: ViewKey, seen: boolean) {
      setBottomSeenStore((state) => {
        state[id] = seen;
      });
    },
  };
}
