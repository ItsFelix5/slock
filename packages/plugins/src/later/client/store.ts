import type { Services } from "@slock/core/types";
import type { ChannelId, Message, SavedItem, Ts } from "@slock/types";
import {
  action,
  createMemo,
  createOptimisticStore,
  createSignal,
  isPending,
  refresh,
} from "solid-js";
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

type SavedList = { failed: boolean; items: SavedItem[] };

const NOT_LOADED: SavedList = { failed: false, items: [] };

type Change = {
  optimistic: (list: SavedItem[]) => void;
  request: () => Promise<unknown>;
};

export function createLaterSlice(api: LaterApi, flash: Services["feedback"]["flash"]) {
  const [requested, setRequested] = createSignal(false);
  async function loadList(): Promise<SavedList> {
    try {
      return { failed: false, items: await api.fetchSaved() };
    } catch (err) {
      console.error("Failed to load Later", err);
      return { failed: true, items: [] };
    }
  }
  const [saved, setSaved] = createOptimisticStore(
    () => (requested() ? loadList() : NOT_LOADED),
    NOT_LOADED,
    { key: (item: SavedItem) => laterKey(item.channelId, item.ts) },
  );
  const [saving, setSaving] = createOptimisticStore<Record<string, boolean>>({});
  const changing = new Set<string>();

  const laterItems = () => saved.items;
  const laterLoading = () => isPending(() => saved.items);
  const laterLoadFailed = () => saved.failed;

  const savedKeys = createMemo(
    () => new Set(saved.items.map((item) => laterKey(item.channelId, item.ts))),
  );

  const isSavedForLater = (channelId: ChannelId, ts: Ts) =>
    savedKeys().has(laterKey(channelId, ts));

  const isSaveForLaterPending = (channelId: ChannelId, ts: Ts) => !!saving[laterKey(channelId, ts)];

  const reloadList = () => refresh(saved).then(() => undefined);

  async function ensureLaterLoaded(): Promise<void> {
    if (requested() && !saved.failed) return;
    setRequested(true);
    await reloadList();
  }

  const reloadIfRequested = () => {
    if (requested()) void reloadList();
  };

  const change = action(function* (
    channelId: ChannelId,
    ts: Ts,
    plan: (currentlySaved: boolean) => Change,
  ) {
    const key = laterKey(channelId, ts);
    if (changing.has(key) || laterLoading()) return false;
    changing.add(key);
    try {
      yield ensureLaterLoaded();
      if (saved.failed) return false;
      const { optimistic, request } = plan(isSavedForLater(channelId, ts));
      setSaving((pending) => {
        pending[key] = true;
      });
      setSaved((draft) => optimistic(draft.items));
      try {
        yield request();
      } catch (err) {
        console.error("Failed to update Later", err);
        flash(ts, "Failed to update Later.", "error");
        return false;
      }
      yield reloadList();
      return true;
    } finally {
      changing.delete(key);
    }
  });

  const toggleSaveForLater = (channelId: ChannelId, ts: Ts): Promise<boolean> =>
    change(channelId, ts, (currentlySaved) => ({
      optimistic: (list) => {
        if (currentlySaved) {
          const index = list.findIndex(matchesSaved(channelId, ts));
          if (index !== -1) list.splice(index, 1);
        } else list.push({ channelId, ts });
      },
      request: () => api.toggleSaved(channelId, ts, currentlySaved),
    }));

  const setReminder = (channelId: ChannelId, ts: Ts, dateDue: number): Promise<boolean> =>
    change(channelId, ts, (currentlySaved) => ({
      optimistic: (list) => {
        const item = list.find(matchesSaved(channelId, ts));
        if (item) item.dateDue = dateDue;
        else list.push({ channelId, dateDue, ts });
      },
      request: () =>
        currentlySaved
          ? api.updateSaved(channelId, ts, { dateDue })
          : api.saveWithReminder(channelId, ts, dateDue),
    }));

  const clearReminder = (channelId: ChannelId, ts: Ts): Promise<boolean> =>
    change(channelId, ts, () => ({
      optimistic: (list) => {
        const item = list.find(matchesSaved(channelId, ts));
        if (item) item.dateDue = undefined;
      },
      request: () => api.updateSaved(channelId, ts, { dateDue: 0 }),
    }));

  const reminderDue = (channelId: ChannelId, ts: Ts) =>
    saved.items.find(matchesSaved(channelId, ts))?.dateDue;

  function createLaterMessage(item: () => SavedItem) {
    return createMemo(async (): Promise<Message | null> => {
      const { channelId, ts } = item();
      const found = await api.fetchMessagesByIds([{ channelId, ts }]);
      return found.get(laterKey(channelId, ts)) ?? null;
    });
  }

  return {
    clearReminder,
    createLaterMessage,
    ensureLaterLoaded,
    isSavedForLater,
    isSaveForLaterPending,
    laterItems,
    laterLoadFailed,
    laterLoading,
    reloadIfRequested,
    reminderDue,
    setReminder,
    toggleSaveForLater,
  };
}
