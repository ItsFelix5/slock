import { paneRowsById, useShortcut } from "@slock/ui";
import { createEffect } from "solid-js";
import { openConversationInSplit } from "../../lib/navigation/conversationNav";
import { store } from "../../lib/store";

const enabled = () => ["home", "activity"].includes(store.viewState.nav());

let lastActivityIndex = -1;

function cycleRows() {
  const rows = paneRowsById("sidebar");
  if (store.viewState.nav() === "home") {
    return { current: rows.findIndex((row) => row.classList.contains("active")), rows };
  }
  const activityRows = rows.filter((row) => row.hasAttribute("data-activity-row"));
  const found = activityRows.findIndex((row) => row.closest(".active"));
  if (found !== -1) lastActivityIndex = found;
  const current = found === -1 && lastActivityIndex === -1 ? 0 : found;
  return { current, rows: activityRows };
}

function cycleTargetRow(direction: -1 | 1) {
  const { current, rows } = cycleRows();
  if (rows.length === 0) return;
  const from = current === -1 ? lastActivityIndex - (direction === 1 ? 1 : 0) : current;
  const index = (from + direction + rows.length) % rows.length;
  if (store.viewState.nav() === "activity") lastActivityIndex = index;
  return rows[index];
}

function stepRow(direction: -1 | 1, split: boolean) {
  const row = cycleTargetRow(direction);
  if (!row) return;
  const { channelId } = row.dataset;
  if (split && channelId) openConversationInSplit(channelId);
  else row.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: split }));
  row.scrollIntoView({ block: "nearest" });
}

export function useSidebarChannelCycle() {
  createEffect(() => {
    if (store.viewState.nav() !== "activity") lastActivityIndex = -1;
  });
  useShortcut({
    allowRepeat: true,
    combo: { key: "j" },
    enabled,
    handler: (event) => stepRow(1, event.shiftKey),
    id: "sidebar.cycleNext",
    label: "Go to the next item",
    scope: "general",
    group: "Channels and search",
    splitModifier: true,
  });
  useShortcut({
    allowRepeat: true,
    combo: { key: "k" },
    enabled,
    handler: (event) => stepRow(-1, event.shiftKey),
    id: "sidebar.cyclePrev",
    label: "Go to the previous item",
    scope: "general",
    group: "Channels and search",
    splitModifier: true,
  });
}
