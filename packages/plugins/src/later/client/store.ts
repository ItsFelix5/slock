import type { Services } from "@slock/core/types";
import type { Message, SavedItem } from "@slock/types";
import { createMemo, createSignal } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import type {
  fetchMessagesByIds,
  fetchSaved,
  saveWithReminder,
  toggleSaved,
  updateSaved,
} from "../../slack/client/api";

export type LaterApi = {
  fetchMessagesByIds: typeof fetchMessagesByIds;
  fetchSaved: typeof fetchSaved;
  saveWithReminder: typeof saveWithReminder;
  toggleSaved: typeof toggleSaved;
  updateSaved: typeof updateSaved;
};

function removeSaved(list: SavedItem[], channelId: string, ts: string) {
  const index = list.findIndex((item) => item.channelId === channelId && item.ts === ts);
  if (index !== -1) list.splice(index, 1);
}

export function createLaterSlice(api: LaterApi, flash: Services["feedback"]["flash"]) {
  const [laterItems, setLaterItems] = createStore<SavedItem[]>([]);
  const [laterLoaded, setLaterLoaded] = createSignal(false);
  const [laterLoading, setLaterLoading] = createSignal(false);
  const [laterLoadError, setLaterLoadError] = createSignal(false);
  const [laterMessages, setLaterMessages] = createStore<Record<string, Message | null>>({});
  const [laterMessageLoading, setLaterMessageLoading] = createStore<Record<string, boolean>>({});
  const [laterMessageError, setLaterMessageError] = createStore<Record<string, boolean>>({});
  const [savePending, setSavePending] = createStore<Record<string, boolean>>({});

  const laterKey = (channelId: string, ts: string) => `${channelId}:${ts}`;

  function isSaveForLaterPending(channelId: string, ts: string): boolean {
    return !!savePending[laterKey(channelId, ts)];
  }

  const savedKeys = createMemo(
    () => new Set(laterItems.map((item) => laterKey(item.channelId, item.ts))),
  );

  function isSavedForLater(channelId: string, ts: string): boolean {
    return savedKeys().has(laterKey(channelId, ts));
  }

  const matches = (channelId: string, ts: string) => (item: SavedItem) =>
    item.channelId === channelId && item.ts === ts;

  async function changeSaved(
    channelId: string,
    ts: string,
    optimistic: (list: SavedItem[]) => void,
    request: () => Promise<unknown>,
  ): Promise<boolean> {
    const pendingKey = laterKey(channelId, ts);
    if (laterLoading() || savePending[pendingKey]) return false;
    setSavePending(pendingKey, true);
    const before = laterItems.map((item) => ({ ...item }));
    setLaterItems(produce(optimistic));
    try {
      await request();
      return true;
    } catch (err) {
      console.error("Failed to update Later", err);
      flash(ts, "Failed to update Later.", "error");
      setLaterItems(reconcile(before));
      return false;
    } finally {
      setSavePending(
        produce((pending) => {
          delete pending[pendingKey];
        }),
      );
    }
  }

  function toggleSaveForLater(channelId: string, ts: string): Promise<boolean> {
    const currentlySaved = isSavedForLater(channelId, ts);
    return changeSaved(
      channelId,
      ts,
      (list) => {
        if (currentlySaved) removeSaved(list, channelId, ts);
        else list.push({ channelId, ts });
      },
      () => api.toggleSaved(channelId, ts, currentlySaved),
    );
  }

  function setReminder(channelId: string, ts: string, dateDue: number): Promise<boolean> {
    const currentlySaved = isSavedForLater(channelId, ts);
    return changeSaved(
      channelId,
      ts,
      (list) => {
        const item = list.find(matches(channelId, ts));
        if (item) item.dateDue = dateDue;
        else list.push({ channelId, dateDue, ts });
      },
      () =>
        currentlySaved
          ? api.updateSaved(channelId, ts, { dateDue })
          : api.saveWithReminder(channelId, ts, dateDue),
    );
  }

  function clearReminder(channelId: string, ts: string): Promise<boolean> {
    return changeSaved(
      channelId,
      ts,
      (list) => {
        const item = list.find(matches(channelId, ts));
        if (item) item.dateDue = undefined;
      },
      () => api.updateSaved(channelId, ts, { dateDue: 0 }),
    );
  }

  function reminderDue(channelId: string, ts: string): number | undefined {
    return laterItems.find(matches(channelId, ts))?.dateDue;
  }

  async function ensureLaterLoaded() {
    if (laterLoading()) return;
    setLaterLoading(true);
    setLaterLoadError(false);
    try {
      const items = await api.fetchSaved();
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
      const key = laterKey(item.channelId, item.ts);
      return !laterMessageLoading[key] && (force || !(key in laterMessages));
    });
    if (!pending.length) return;
    for (const item of pending) {
      const key = laterKey(item.channelId, item.ts);
      setLaterMessageLoading(key, true);
      setLaterMessageError(key, false);
    }
    const resolved = new Set<string>();
    try {
      const messages = await api.fetchMessagesByIds(
        pending,
        (batch) => {
          for (const [key, message] of batch) {
            resolved.add(key);
            setLaterMessages(key, message);
          }
        },
        force,
      );
      for (const item of pending) {
        const key = laterKey(item.channelId, item.ts);
        setLaterMessages(key, messages.get(key) ?? null);
      }
    } catch (err) {
      console.error("Failed to load saved message", err);
      for (const item of pending) {
        const key = laterKey(item.channelId, item.ts);
        if (!resolved.has(key)) setLaterMessageError(key, true);
      }
    } finally {
      setLaterMessageLoading(
        produce((loading) => {
          for (const item of pending) delete loading[laterKey(item.channelId, item.ts)];
        }),
      );
    }
  }

  function ensureLaterMessageLoaded(item: SavedItem): Promise<void> {
    return loadLaterMessages([item]);
  }

  function hasLaterMessageError(channelId: string, ts: string): boolean {
    return !!laterMessageError[laterKey(channelId, ts)];
  }

  function laterMessageFor(channelId: string, ts: string): Message | null | undefined {
    return laterMessages[laterKey(channelId, ts)];
  }

  function isLaterMessageLoading(channelId: string, ts: string): boolean {
    return !!laterMessageLoading[laterKey(channelId, ts)];
  }

  function applySavedEvent(action: "add" | "remove" | "clear", channelId?: string, ts?: string) {
    if (!laterLoaded()) return;
    if (action === "clear") {
      setLaterItems([]);
      return;
    }
    if (!(channelId && ts)) return;
    if (action === "remove") {
      setLaterItems((list) =>
        list.filter((item) => item.channelId !== channelId || item.ts !== ts),
      );
    } else if (!isSavedForLater(channelId, ts)) {
      setLaterItems(produce((list) => list.push({ channelId, ts })));
    }
  }

  return {
    applySavedEvent,
    clearReminder,
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
    reminderDue,
    setReminder,
    laterMessageFor,
    toggleSaveForLater,
  };
}
