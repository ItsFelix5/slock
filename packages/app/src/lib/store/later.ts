import type { Message, SavedItem } from "@slock/slack-api";
import { fetchHistory, fetchReplies, fetchSaved, toggleSaved } from "@slock/slack-api";
import { createSignal } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import { actionFeedback } from "./feedback";

export function createLaterSlice() {
  const [laterItems, setLaterItems] = createStore<SavedItem[]>([]);
  const [laterLoaded, setLaterLoaded] = createSignal(false);
  const [laterMessages, setLaterMessages] = createStore<Record<string, Message | null>>({});

  function isSavedForLater(ts: string): boolean {
    return laterItems.some((i) => i.ts === ts);
  }

  async function toggleSaveForLater(channelId: string, ts: string) {
    const currentlySaved = isSavedForLater(ts);
    if (currentlySaved) {
      setLaterItems((list) => list.filter((i) => i.ts !== ts));
    } else {
      setLaterItems(produce((list) => list.push({ channelId, ts })));
    }
    try {
      await toggleSaved(channelId, ts, currentlySaved);
    } catch (err) {
      console.error("Failed to toggle saved-for-later", err);
      actionFeedback.flash(ts, "Failed to update Later.", "error");
      if (currentlySaved) setLaterItems(produce((list) => list.push({ channelId, ts })));
      else setLaterItems((list) => list.filter((i) => i.ts !== ts));
    }
  }

  async function ensureLaterLoaded() {
    if (laterLoaded()) return;
    setLaterLoaded(true);
    try {
      const items = await fetchSaved();
      setLaterItems(reconcile(items));
      for (const item of items) {
        fetchHistory(item.channelId).catch(() => []); // warms channel name/topic cache lookups
      }
    } catch {
      setLaterLoaded(false);
    }
  }

  async function ensureLaterMessageLoaded(item: SavedItem) {
    const key = `${item.channelId}:${item.ts}`;
    if (key in laterMessages) return;
    try {
      const replies = await fetchReplies(item.channelId, item.ts);
      const msg = replies.find((m) => m.ts === item.ts);
      setLaterMessages(key, msg ?? null);
    } catch {
      setLaterMessages(key, null);
    }
  }

  return {
    isSavedForLater,
    toggleSaveForLater,
    laterItems,
    laterMessages,
    ensureLaterLoaded,
    ensureLaterMessageLoaded,
  };
}
