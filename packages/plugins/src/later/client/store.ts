import type { Services } from "@slock/core/types";
import { defineMutation, defineQuery } from "@slock/plugins/query/client/api";
import type { fetchMessagesByIds } from "@slock/plugins/slack/client/api";
import { isWaiting } from "@slock/resource";
import type { ChannelId, Message, SavedItem, Ts } from "@slock/types";
import { createProjection, createSignal } from "solid-js";
import type { fetchSaved, saveWithReminder, toggleSaved, updateSaved } from "./requests";
import { laterKey, matchesSaved } from "./savedItems";

export type LaterApi = {
  fetchMessagesByIds: typeof fetchMessagesByIds;
  fetchSaved: typeof fetchSaved;
  saveWithReminder: typeof saveWithReminder;
  toggleSaved: typeof toggleSaved;
  updateSaved: typeof updateSaved;
};

type Target = { channelId: ChannelId; ts: Ts };

type Change = {
  apply: (list: SavedItem[]) => SavedItem[];
  send: () => Promise<unknown>;
};

const ALL = "saved";
const NONE: SavedItem[] = [];

function withReminder({ channelId, ts }: Target, dateDue: number | undefined) {
  const matches = matchesSaved(channelId, ts);
  return (list: SavedItem[]) => list.map((item) => (matches(item) ? { ...item, dateDue } : item));
}

function withSaved({ channelId, ts }: Target, item: SavedItem) {
  return (list: SavedItem[]) => (list.some(matchesSaved(channelId, ts)) ? list : [...list, item]);
}

export function createLaterSlice(api: LaterApi, flash: Services["feedback"]["flash"]) {
  const savedList = defineQuery<typeof ALL, SavedItem[]>({
    gcMs: Number.POSITIVE_INFINITY,
    load: (_, { signal }) => api.fetchSaved(signal),
    name: "later",
  });
  const savedMessage = defineQuery<Target, Message | null>({
    load: async ({ channelId, ts }) => {
      const found = await api.fetchMessagesByIds([{ channelId, ts }]);
      return found.get(laterKey(channelId, ts)) ?? null;
    },
    name: "laterMessage",
  });
  const savedChange = defineMutation<Change & Target>({
    key: ({ channelId, ts }) => laterKey(channelId, ts),
    mode: "single",
    onError: (error, { ts }) => {
      console.error("Failed to update Later", error);
      flash(ts, "Failed to update Later.", "error");
    },
    onSuccess: () => savedList.invalidate(ALL),
    optimistic: ({ apply }, transaction) => transaction.apply(savedList, ALL, apply),
    run: async ({ send }) => {
      await send();
    },
  });

  const [requested, setRequested] = createSignal(false);
  const state = savedList.state(() => (requested() ? ALL : undefined));

  const laterItems = () => state().data ?? NONE;
  const laterLoading = () => requested() && !state().data && isWaiting(state());
  const laterLoadFailed = () => !state().data && state().status === "error";

  const savedKeys = createProjection<Record<string, true>>(
    () => Object.fromEntries(laterItems().map((item) => [laterKey(item.channelId, item.ts), true])),
    {},
  );

  const isSavedForLater = (channelId: ChannelId, ts: Ts) => !!savedKeys[laterKey(channelId, ts)];

  const isSaveForLaterPending = (channelId: ChannelId, ts: Ts) =>
    savedChange.pending(laterKey(channelId, ts));

  async function ensureLaterLoaded(): Promise<void> {
    setRequested(true);
    try {
      await savedList.ensure(ALL);
    } catch (error) {
      console.error("Failed to load Later", error);
    }
  }

  async function change(
    target: Target,
    plan: (currentlySaved: boolean) => Change,
  ): Promise<boolean> {
    if (laterLoading()) return false;
    if (!savedList.read(ALL)) await ensureLaterLoaded();
    const list = savedList.read(ALL);
    if (!list) return false;
    const currentlySaved = list.some(matchesSaved(target.channelId, target.ts));
    return savedChange.run({ ...target, ...plan(currentlySaved) });
  }

  const toggleSaveForLater = (channelId: ChannelId, ts: Ts) =>
    change({ channelId, ts }, (currentlySaved) => ({
      apply: currentlySaved
        ? (list) => list.filter((item) => !matchesSaved(channelId, ts)(item))
        : withSaved({ channelId, ts }, { channelId, ts }),
      send: () => api.toggleSaved(channelId, ts, currentlySaved),
    }));

  const setReminder = (channelId: ChannelId, ts: Ts, dateDue: number) =>
    change({ channelId, ts }, (currentlySaved) => ({
      apply: currentlySaved
        ? withReminder({ channelId, ts }, dateDue)
        : withSaved({ channelId, ts }, { channelId, dateDue, ts }),
      send: () =>
        currentlySaved
          ? api.updateSaved(channelId, ts, { dateDue })
          : api.saveWithReminder(channelId, ts, dateDue),
    }));

  const clearReminder = (channelId: ChannelId, ts: Ts) =>
    change({ channelId, ts }, () => ({
      apply: withReminder({ channelId, ts }, undefined),
      send: () => api.updateSaved(channelId, ts, { dateDue: 0 }),
    }));

  const reminderDue = (channelId: ChannelId, ts: Ts) =>
    laterItems().find(matchesSaved(channelId, ts))?.dateDue;

  function createLaterMessage(item: () => SavedItem) {
    const target = () => ({ channelId: item().channelId, ts: item().ts });
    return {
      retry: () => void savedMessage.refresh(target()).catch(() => {}),
      state: savedMessage.state(target),
    };
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
    reloadIfRequested: () => savedList.invalidate(ALL),
    reminderDue,
    setReminder,
    toggleSaveForLater,
  };
}
