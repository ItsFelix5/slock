import type { UserPrefs } from "@slock/slack-api";
import { setChannelTabs as setChannelTabsApi } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";
import {
  ADDABLE_CHANNEL_TABS,
  type ChannelTabType,
  channelTabsFeedbackKey,
} from "../../../channelTabMeta";
import { actionFeedback } from "../feedback";

// Which extra tabs (beyond the always-present Messages) show under a
// channel's header. This is this app's own feature, not Slack's real
// `properties.tabs` (admin-only, no known write endpoint) — synced through
// the same users.prefs blob as search history/pingwords (custom key) rather
// than localStorage, so it follows the account across devices.
export function createChannelTabsSlice(deps: { userPrefs: () => UserPrefs | undefined }) {
  const [channelTabs, setChannelTabs] = createSignal<Record<string, ChannelTabType[]>>({});

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

  function persist(changedChannelId: string, next: Record<string, ChannelTabType[]>) {
    const previous = channelTabs();
    setChannelTabs(next);
    const payload: Record<string, { type: string }[]> = {};
    for (const [channelId, types] of Object.entries(next)) {
      if (types.length) payload[channelId] = types.map((type) => ({ type }));
    }
    setChannelTabsApi(payload).catch((err) => {
      console.error("Failed to sync channel tabs", err);
      setChannelTabs(previous);
      const message = err instanceof Error ? err.message : "Failed to save tab changes.";
      actionFeedback.flash(channelTabsFeedbackKey(changedChannelId), message, "error");
    });
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

  return { addChannelTab, channelTabs, moveChannelTab, removeChannelTab, tabsForChannel };
}
