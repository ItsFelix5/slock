import { createSignal } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import type { Message, SavedItem } from "../../../api";
import { fetchMessagesByIds, fetchSaved, toggleSaved } from "../../../api";
import { actionFeedback } from "../../../feedback";

export function createLaterSlice() {
  const [laterItems, setLaterItems] = createStore<SavedItem[]>([]);
  const [laterLoaded, setLaterLoaded] = createSignal(false);
  const [laterLoading, setLaterLoading] = createSignal(false);
  const [laterLoadError, setLaterLoadError] = createSignal(false);
  const [laterMessages, setLaterMessages] = createStore<Record<string, Message | null>>({});
  const [laterMessageLoading, setLaterMessageLoading] = createStore<Record<string, boolean>>({});
  const [laterMessageError, setLaterMessageError] = createStore<Record<string, boolean>>({});
  const [savePending, setSavePending] = createStore<Record<string, boolean>>({});

  const savePendingKey = (channelId: string, ts: string) => `${channelId}:${ts}`;

  function isSaveForLaterPending(channelId: string, ts: string): boolean {
    return !!savePending[savePendingKey(channelId, ts)];
  }

  function isSavedForLater(channelId: string, ts: string): boolean {
    return laterItems.some((item) => item.channelId === channelId && item.ts === ts);
  }

  async function toggleSaveForLater(channelId: string, ts: string): Promise<boolean> {
    const pendingKey = savePendingKey(channelId, ts);
    if (laterLoading() || savePending[pendingKey]) return false;
    setSavePending(pendingKey, true);
    const currentlySaved = isSavedForLater(channelId, ts);
    if (currentlySaved) {
      setLaterItems((list) =>
        list.filter((item) => item.channelId !== channelId || item.ts !== ts),
      );
    } else {
      setLaterItems(produce((list) => list.push({ channelId, ts })));
    }
    try {
      await toggleSaved(channelId, ts, currentlySaved);
      return true;
    } catch (err) {
      console.error("Failed to toggle saved-for-later", err);
      actionFeedback.flash(ts, "Failed to update Later.", "error");
      if (currentlySaved) setLaterItems(produce((list) => list.push({ channelId, ts })));
      else
        setLaterItems((list) =>
          list.filter((item) => item.channelId !== channelId || item.ts !== ts),
        );
      return false;
    } finally {
      setSavePending(
        produce((pending) => {
          delete pending[pendingKey];
        }),
      );
    }
  }

  async function ensureLaterLoaded() {
    if (laterLoading()) return;
    setLaterLoading(true);
    setLaterLoadError(false);
    try {
      const items = await fetchSaved();
      setLaterItems(reconcile(items));
      setLaterLoaded(true);
      void loadLaterMessages(items, true);
    } catch (err) {
      console.error("Failed to load Later", err);
      setLaterLoadError(true);
    } finally {
      setLaterLoading(false);
    }
  }

  async function loadLaterMessages(items: SavedItem[], force = false) {
    const pending = items.filter((item) => {
      const key = `${item.channelId}:${item.ts}`;
      return !laterMessageLoading[key] && (force || !(key in laterMessages));
    });
    if (!pending.length) return;
    for (const item of pending) {
      const key = `${item.channelId}:${item.ts}`;
      setLaterMessageLoading(key, true);
      setLaterMessageError(key, false);
    }
    const resolved = new Set<string>();
    try {
      const messages = await fetchMessagesByIds(pending, (batch) => {
        for (const [key, message] of batch) {
          resolved.add(key);
          setLaterMessages(key, message);
        }
      });
      for (const item of pending) {
        const key = `${item.channelId}:${item.ts}`;
        setLaterMessages(key, messages.get(key) ?? null);
      }
    } catch (err) {
      console.error("Failed to load saved message", err);
      for (const item of pending) {
        const key = `${item.channelId}:${item.ts}`;
        if (!resolved.has(key)) setLaterMessageError(key, true);
      }
    } finally {
      setLaterMessageLoading(
        produce((loading) => {
          for (const item of pending) delete loading[`${item.channelId}:${item.ts}`];
        }),
      );
    }
  }

  function ensureLaterMessageLoaded(item: SavedItem): Promise<void> {
    return loadLaterMessages([item]);
  }

  function hasLaterMessageError(channelId: string, ts: string): boolean {
    return !!laterMessageError[`${channelId}:${ts}`];
  }

  function laterMessageFor(channelId: string, ts: string): Message | null | undefined {
    return laterMessages[`${channelId}:${ts}`];
  }

  function isLaterMessageLoading(channelId: string, ts: string): boolean {
    return !!laterMessageLoading[`${channelId}:${ts}`];
  }

  return {
    ensureLaterLoaded,
    ensureLaterMessageLoaded,
    hasLaterMessageError,
    isLaterMessageLoading,
    isSavedForLater,
    isSaveForLaterPending,
    laterItems,
    laterLoaded,
    laterLoading,
    laterLoadError,
    laterMessageFor,
    toggleSaveForLater,
  };
}
