import type { UserPrefs } from "@slock/slack-api";
import { setChannelTabs as setChannelTabsApi } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";
import {
  ADDABLE_CHANNEL_TABS,
  type ChannelTabType,
  channelTabsFeedbackKey,
} from "../../../channelTabMeta";
import { actionFeedback } from "../feedback";

export function createChannelTabsSlice(deps: { userPrefs: () => UserPrefs | undefined }) {
  const [channelTabs, setChannelTabs] = createSignal<Record<string, ChannelTabType[]>>({});
  const [pending, setPending] = createSignal(false);

  let seeded = false;
  createEffect(() => {
    const prefs = deps.userPrefs();
    if (!prefs || seeded) return;
    seeded = true;
    const next: Record<string, ChannelTabType[]> = {};
    for (const [channelId, entries] of Object.entries(prefs.channelTabs)) {
      const types = entries
        .map((e) => e.type)
        .filter((t): t is ChannelTabType => ADDABLE_CHANNEL_TABS.some((a) => a.type === t));
      if (types.length) next[channelId] = types;
    }
    setChannelTabs(next);
  });

  async function persist(
    changedChannelId: string,
    next: Record<string, ChannelTabType[]>,
  ): Promise<void> {
    if (pending()) return;
    if (!deps.userPrefs()) {
      actionFeedback.flash(
        channelTabsFeedbackKey(changedChannelId),
        "Preferences are unavailable. Try loading them again.",
        "error",
      );
      return;
    }
    const previous = channelTabs();
    setPending(true);
    setChannelTabs(next);
    const payload: Record<string, { type: string }[]> = {};
    for (const [channelId, types] of Object.entries(next)) {
      if (types.length) payload[channelId] = types.map((type) => ({ type }));
    }
    try {
      await setChannelTabsApi(payload);
    } catch (err) {
      console.error("Failed to sync channel tabs", err);
      setChannelTabs(previous);
      const message = err instanceof Error ? err.message : "Failed to save tab changes.";
      actionFeedback.flash(channelTabsFeedbackKey(changedChannelId), message, "error");
    } finally {
      setPending(false);
    }
  }

  function tabsForChannel(channelId: string): ChannelTabType[] {
    return channelTabs()[channelId] ?? [];
  }

  function addChannelTab(channelId: string, type: ChannelTabType) {
    const current = tabsForChannel(channelId);
    if (current.includes(type)) return;
    persist(channelId, { ...channelTabs(), [channelId]: [...current, type] });
  }

  function removeChannelTab(channelId: string, type: ChannelTabType) {
    persist(channelId, {
      ...channelTabs(),
      [channelId]: tabsForChannel(channelId).filter((t) => t !== type),
    });
  }

  function moveChannelTab(channelId: string, type: ChannelTabType, direction: -1 | 1) {
    const current = tabsForChannel(channelId);
    const index = current.indexOf(type);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    persist(channelId, { ...channelTabs(), [channelId]: next });
  }

  return {
    addChannelTab,
    channelTabs,
    isPending: pending,
    moveChannelTab,
    removeChannelTab,
    tabsForChannel,
  };
}
