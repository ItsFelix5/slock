import type { ChannelId, SavedItem, Ts } from "@slock/types";

export const laterKey = (channelId: ChannelId, ts: Ts) => `${channelId}:${ts}`;

export const matchesSaved = (channelId: ChannelId, ts: Ts) => (item: SavedItem) =>
  item.channelId === channelId && item.ts === ts;
