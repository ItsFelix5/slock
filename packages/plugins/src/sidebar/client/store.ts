import { focusPaneById } from "@slock/ui";
import { createSignal } from "solid-js";

export function createSidebarStore(isHidden: (id: string) => boolean) {
  const [nav, setNav] = createSignal("home");

  function setNavView(next: string) {
    setNav(next);
    if (!isHidden(next)) queueMicrotask(() => focusPaneById("sidebar"));
  }

  return { nav, setNavView };
}
