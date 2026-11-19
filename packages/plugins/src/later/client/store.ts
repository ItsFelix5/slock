import type { Services } from "@slock/core/types";
import type { ChannelId, Message, SavedItem, Ts } from "@slock/types";
import { createMemo, createSignal, createStore, reconcile } from "solid-js";
import type {
  fetchMessagesByIds,
  fetchSaved,
  saveWithReminder,
  toggleSaved,
  updateSaved,
} from "../../slack/client/api";
import { laterKey, matchesSaved } from "./savedItems";

export type LaterApi = {
  fetchMessagesByIds: typeof fetchMessagesByIds;
  fetchSaved: typeof fetchSaved;
  saveWithReminder: typeof saveWithReminder;
  toggleSaved: typeof toggleSaved;
  updateSaved: typeof updateSaved;
};

type ListStatus = "idle" | "loading" | "error";
type MessageStatus = "loading" | "error";

export function createLaterSlice(api: LaterApi, flash: Services["feedback"]["flash"]) {
  const [laterItems, setLaterItems] = createStore<SavedItem[]>([]);
  const [laterLoaded, setLaterLoaded] = createSignal(false);
  const [listStatus, setListStatus] = createSignal<ListStatus>("idle");
  const [laterMessages, setLaterMessages] = createStore<Record<string, Message | null>>({});
  const [messageStatus, setMessageStatus] = createStore<Record<string, MessageStatus>>({});
  const [savePending, setSavePending] = createStore<Record<string, boolean>>({});

  const changing = new Set<string>();
  const loadingMessages = new Set<string>();
  let inflight: Promise<void> | undefined;

  const laterLoading = () => listStatus() === "loading";
  const laterLoadError = () => listStatus() === "error";

  const isSaveForLaterPending = (channelId: ChannelId, ts: Ts) =>
    !!savePending[laterKey(channelId, ts)];

  const savedKeys = createMemo(
    () => new Set(laterItems.map((item) => laterKey(item.channelId, item.ts))),
  );

  const isSavedForLater = (channelId: ChannelId, ts: Ts) =>
    savedKeys().has(laterKey(channelId, ts));

  async function changeSaved(
    channelId: ChannelId,
    ts: Ts,
    optimistic: (list: SavedItem[]) => void,
    request: () => Promise<unknown>,
  ): Promise<boolean> {
    const pendingKey = laterKey(channelId, ts);
    if (inflight || changing.has(pendingKey)) return false;
    changing.add(pendingKey);
    setSavePending((pending) => {
      pending[pendingKey] = true;
    });
    const before = laterItems.map((item) => ({ ...item }));
    setLaterItems(optimistic);
    try {
      await request();
      return true;
    } catch (err) {
      console.error("Failed to update Later", err);
      flash(ts, "Failed to update Later.", "error");
      setLaterItems(reconcile(before));
      return false;
    } finally {
      changing.delete(pendingKey);
      setSavePending((pending) => {
        delete pending[pendingKey];
      });
    }
  }

  function toggleSaveForLater(channelId: ChannelId, ts: Ts): Promise<boolean> {
    const currentlySaved = isSavedForLater(channelId, ts);
    return changeSaved(
      channelId,
      ts,
      (list) => {
        if (currentlySaved) {
          const index = list.findIndex(matchesSaved(channelId, ts));
          if (index !== -1) list.splice(index, 1);
        } else list.push({ channelId, ts });
      },
      () => api.toggleSaved(channelId, ts, currentlySaved),
    );
  }

  function setReminder(channelId: ChannelId, ts: Ts, dateDue: number): Promise<boolean> {
    const currentlySaved = isSavedForLater(channelId, ts);
    return changeSaved(
      channelId,
      ts,
      (list) => {
        const item = list.find(matchesSaved(channelId, ts));
        if (item) item.dateDue = dateDue;
        else list.push({ channelId, dateDue, ts });
      },
      () =>
        currentlySaved
          ? api.updateSaved(channelId, ts, { dateDue })
          : api.saveWithReminder(channelId, ts, dateDue),
    );
  }

  function clearReminder(channelId: ChannelId, ts: Ts): Promise<boolean> {
    return changeSaved(
      channelId,
      ts,
      (list) => {
        const item = list.find(matchesSaved(channelId, ts));
        if (item) item.dateDue = undefined;
      },
      () => api.updateSaved(channelId, ts, { dateDue: 0 }),
    );
  }

  const reminderDue = (channelId: ChannelId, ts: Ts) =>
    laterItems.find(matchesSaved(channelId, ts))?.dateDue;

  async function loadLater() {
    setListStatus("loading");
    try {
      const items = await api.fetchSaved();
      setLaterItems(reconcile(items));
      setLaterLoaded(true);
      setListStatus("idle");
      void loadLaterMessages(items, true);
    } catch (err) {
      console.error("Failed to load Later", err);
      setListStatus("error");
    } finally {
      inflight = undefined;
    }
  }

  function ensureLaterLoaded(): Promise<void> {
    inflight ??= loadLater();
    return inflight;
  }

  async function loadLaterMessages(items: SavedItem[], force = false) {
    const pending = items.filter((item) => {
      const key = laterKey(item.channelId, item.ts);
      return !loadingMessages.has(key) && (force || !(key in laterMessages));
    });
    if (!pending.length) return;
    const keys = pending.map((item) => laterKey(item.channelId, item.ts));
    for (const key of keys) loadingMessages.add(key);
    setMessageStatus((status) => {
      for (const key of keys) status[key] = "loading";
    });
    const resolved = new Set<string>();
    try {
      const messages = await api.fetchMessagesByIds(
        pending,
        (batch) => {
          setLaterMessages((cache) => {
            for (const [key, message] of batch) {
              resolved.add(key);
              cache[key] = message;
            }
          });
        },
        force,
      );
      setLaterMessages((cache) => {
        for (const key of keys) cache[key] = messages.get(key) ?? null;
      });
      setMessageStatus((status) => {
        for (const key of keys) delete status[key];
      });
    } catch (err) {
      console.error("Failed to load saved message", err);
      setMessageStatus((status) => {
        for (const key of keys) {
          if (resolved.has(key)) delete status[key];
          else status[key] = "error";
        }
      });
    } finally {
      for (const key of keys) loadingMessages.delete(key);
    }
  }

  const ensureLaterMessageLoaded = (item: SavedItem) => loadLaterMessages([item]);
  const hasLaterMessageError = (channelId: ChannelId, ts: Ts) =>
    messageStatus[laterKey(channelId, ts)] === "error";
  const isLaterMessageLoading = (channelId: ChannelId, ts: Ts) =>
    messageStatus[laterKey(channelId, ts)] === "loading";
  const laterMessageFor = (channelId: ChannelId, ts: Ts): Message | null | undefined =>
    laterMessages[laterKey(channelId, ts)];

  function applySavedEvent(action: "add" | "remove" | "clear", channelId?: ChannelId, ts?: Ts) {
    if (!laterLoaded()) return;
    if (action === "clear") {
      setLaterItems(reconcile([]));
      return;
    }
    if (!(channelId && ts)) return;
    if (action === "remove") {
      setLaterItems((list) => {
        const index = list.findIndex(matchesSaved(channelId, ts));
        if (index !== -1) list.splice(index, 1);
      });
    } else {
      setLaterItems((list) => {
        if (!list.some(matchesSaved(channelId, ts))) list.push({ channelId, ts });
      });
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
    laterMessageFor,
    reminderDue,
    setReminder,
    toggleSaveForLater,
  };
}
