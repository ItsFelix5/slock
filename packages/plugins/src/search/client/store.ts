import type { ChannelId } from "@slock/types";
import { createSignal } from "solid-js";
import { buildSearchQuery, DEFAULT_INPUTS, type SearchInputs } from "./searchQuery";

export function createSearchStore(deps: { showScreen: () => void }) {
  let saved: SearchInputs = { ...DEFAULT_INPUTS, scope: "messages" };
  const [opened, setOpened] = createSignal(0);

  function show(next: SearchInputs) {
    if (next.query) saved = next;
    setOpened((count) => count + 1);
    deps.showScreen();
  }

  function openSearch(query: string, options: { inChannelId?: ChannelId } = {}) {
    const built = buildSearchQuery(query, options.inChannelId);
    show({ ...saved, query: built, scope: "messages" });
  }

  return {
    opened,
    openSearch,
    show,
    save(next: SearchInputs) {
      saved = next;
    },
    saved: () => saved,
  };
}
