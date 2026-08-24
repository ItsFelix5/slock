import type { ChannelTabType } from "../../../channelTabMeta";
import { createLocalPref } from "../../../localPref";

export function createChannelTabsSlice() {
  const [channelTabs, persist] = createLocalPref<Record<string, ChannelTabType[]>>(
    "channel-tabs",
    {},
  );

  function tabsForChannel(channelId: string): ChannelTabType[] {
    return channelTabs()[channelId] ?? [];
  }

  function addChannelTab(channelId: string, type: ChannelTabType) {
    const current = tabsForChannel(channelId);
    if (current.includes(type)) return;
    persist({ ...channelTabs(), [channelId]: [...current, type] });
  }

  function removeChannelTab(channelId: string, type: ChannelTabType) {
    persist({
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
    persist({ ...channelTabs(), [channelId]: next });
  }

  return {
    addChannelTab,
    channelTabs,
    moveChannelTab,
    removeChannelTab,
    tabsForChannel,
  };
}
