import type { ChannelId, Ts } from "@slock/types";
import { type Accessor, createEffect, createSignal, createStore, onCleanup } from "solid-js";

type ViewKey = ChannelId | Ts;

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

  const setBottomSeen = (id: ViewKey, seen: boolean) =>
    setBottomSeenStore((state) => {
      state[id] = seen;
    });

  return {
    isViewed: (id: ViewKey) => windowActive() && !!bottomSeen[id],
    setBottomSeen,
    trackBottomSeen(id: Accessor<ViewKey | undefined>, seen: Accessor<boolean>) {
      createEffect(
        () => ({ id: id(), seen: seen() }),
        (view) => {
          if (!view.id) return;
          const { id } = view;
          setBottomSeen(id, view.seen);
          return () => setBottomSeen(id, false);
        },
      );
    },
  };
}
