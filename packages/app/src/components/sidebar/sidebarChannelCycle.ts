import { paneRowsById, plainKey, useShortcut } from "@slock/ui";
import { suppressNextComposerAutofocus } from "../../lib/composerFocus";
import { store } from "../../lib/store";
import { openConversationInSplit } from "../navigation/SplitNavigation";

function cycleTargetRow(key: string) {
  const rows = paneRowsById("sidebar");
  if (rows.length === 0) return;
  const current = rows.findIndex((row) => row.classList.contains("active"));
  const direction = key.toLowerCase() === "j" ? 1 : -1;
  return rows[(current + direction + rows.length) % rows.length];
}

export function useSidebarChannelCycle() {
  useShortcut({
    allowRepeat: true,
    enabled: () => store.viewState.nav() === "home",
    handler: (e) => {
      const target = cycleTargetRow(e.key);
      suppressNextComposerAutofocus();
      target?.click();
    },
    keys: "j / k",
    label: "Go to the previous / next channel",
    match: plainKey("j", "k"),
    scope: "general",
  });
  useShortcut({
    allowRepeat: true,
    enabled: () => store.viewState.nav() === "home",
    handler: (e) => {
      const id = cycleTargetRow(e.key)?.dataset.channelId;
      if (id) openConversationInSplit(id);
    },
    keys: "Ctrl/⌘ J / K",
    label: "Open the previous / next channel in a new split",
    match: (e) => (e.ctrlKey || e.metaKey) && ["j", "k"].includes(e.key.toLowerCase()),
    scope: "general",
  });
}
