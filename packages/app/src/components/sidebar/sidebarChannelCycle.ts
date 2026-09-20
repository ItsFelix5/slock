import { paneRowsById, useShortcut } from "@slock/ui";
import { openConversationInSplit } from "../../lib/navigation/conversationNav";
import { store } from "../../lib/store";

function cycleTargetRow(direction: -1 | 1) {
  const rows = paneRowsById("sidebar");
  if (rows.length === 0) return;
  const current = rows.findIndex((row) => row.classList.contains("active"));
  return rows[(current + direction + rows.length) % rows.length];
}

export function useSidebarChannelCycle() {
  const enabled = () => store.viewState.nav() === "home";
  useShortcut({
    allowRepeat: true,
    combo: { key: "j" },
    enabled,
    handler: () => cycleTargetRow(1)?.click(),
    id: "sidebar.cycleNext",
    label: "Go to the next channel",
    scope: "general",
  });
  useShortcut({
    allowRepeat: true,
    combo: { key: "k" },
    enabled,
    handler: () => cycleTargetRow(-1)?.click(),
    id: "sidebar.cyclePrev",
    label: "Go to the previous channel",
    scope: "general",
  });
  useShortcut({
    allowRepeat: true,
    combo: { key: "j", shift: true },
    enabled,
    handler: () => {
      const id = cycleTargetRow(1)?.dataset.channelId;
      if (id) openConversationInSplit(id);
    },
    id: "sidebar.cycleNextSplit",
    label: "Open the next channel in a new split",
    scope: "general",
  });
  useShortcut({
    allowRepeat: true,
    combo: { key: "k", shift: true },
    enabled,
    handler: () => {
      const id = cycleTargetRow(-1)?.dataset.channelId;
      if (id) openConversationInSplit(id);
    },
    id: "sidebar.cyclePrevSplit",
    label: "Open the previous channel in a new split",
    scope: "general",
  });
}
