import {
  fetchChannelDetails,
  fetchConversationView,
  fetchHistoryAround,
} from "@slock/plugins/slack/client/api";
import type { ChannelId, Ts } from "@slock/types";
import { fetchHistory, fetchHistoryNewer } from "../../requests/history";

export type MessageHistoryApi = {
  fetchChannelDetails: (channelId: ChannelId) => ReturnType<typeof fetchChannelDetails>;
  fetchConversationView: (channelId: ChannelId) => ReturnType<typeof fetchConversationView>;
  fetchHistory: (channelId: ChannelId, cursor?: string) => ReturnType<typeof fetchHistory>;
  fetchHistoryAround: (channelId: ChannelId, ts: Ts) => ReturnType<typeof fetchHistoryAround>;
  fetchHistoryNewer: (
    channelId: ChannelId,
    oldest: Ts,
    spanHint?: number,
  ) => ReturnType<typeof fetchHistoryNewer>;
};

export const DEFAULT_HISTORY_API: MessageHistoryApi = {
  fetchChannelDetails,
  fetchConversationView,
  fetchHistory,
  fetchHistoryAround,
  fetchHistoryNewer,
};
