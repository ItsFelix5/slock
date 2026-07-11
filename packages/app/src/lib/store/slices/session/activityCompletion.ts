import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";

const STORAGE_KEY = "slock:completed-activity-ids";

// "Marked as complete" is a personal triage flag with no Slack-side
// equivalent (unlike read/unread, which Slack itself owns) — a lightweight
// local checklist over activity items, purely client-side by design.
function loadCompletedIds(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function createActivityCompletionSlice() {
  const [completedActivityIds, setCompletedActivityIds] = createStore<Record<string, boolean>>(
    loadCompletedIds(),
  );

  createEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...completedActivityIds }));
  });

  function isActivityComplete(id: string): boolean {
    return !!completedActivityIds[id];
  }

  function toggleActivityComplete(id: string) {
    setCompletedActivityIds(id, !completedActivityIds[id]);
  }

  return { isActivityComplete, toggleActivityComplete };
}
