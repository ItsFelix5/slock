import type { ChannelId, Ts } from "@slock/types";
import {
  fetchChannelDetails,
  fetchConversationView,
  fetchHistory,
  fetchHistoryAround,
  fetchHistoryNewer,
} from "../../../../slack/client/api";

export type MessageHistoryApi = {
  fetchChannelDetails: (channelId: ChannelId) => ReturnType<typeof fetchChannelDetails>;
  fetchConversationView: (channelId: ChannelId) => ReturnType<typeof fetchConversationView>;
  fetchHistory: (channelId: ChannelId, cursor?: string) => ReturnType<typeof fetchHistory>;
  fetchHistoryAround: (channelId: ChannelId, ts: Ts) => ReturnType<typeof fetchHistoryAround>;
  fetchHistoryNewer: (channelId: ChannelId, oldest: Ts) => ReturnType<typeof fetchHistoryNewer>;
};

export const DEFAULT_HISTORY_API: MessageHistoryApi = {
  fetchChannelDetails,
  fetchConversationView,
  fetchHistory,
  fetchHistoryAround,
  fetchHistoryNewer,
};
