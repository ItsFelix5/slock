import { service } from "@slock/core/solid";
import { apiGet, mapChannel, mapChannelDetails, mapUser, mapVisibleMessages } from "@slock/slack";
import type {
  CanvasListItem,
  ConversationViewData,
  RawChannel,
  RawMessage,
  RawUser,
} from "@slock/types";
import { defineKey } from "../../../query/client/api";

const conversationViewKey = defineKey<[string]>("conversationView");

function mapCanvasTabs(channel: RawChannel): CanvasListItem[] {
  const seen = new Set<string>();
  const result: CanvasListItem[] = [];
  const defaultFileId = channel.properties?.canvas?.file_id;
  if (defaultFileId) {
    seen.add(defaultFileId);
    result.push({ fileId: defaultFileId, title: "" });
  }
  for (const tab of channel.properties?.tabs ?? []) {
    const fileId = tab.type === "canvas" ? tab.data?.file_id : undefined;
    if (!fileId || seen.has(fileId)) continue;
    seen.add(fileId);
    result.push({ fileId, title: tab.label?.trim() ?? "" });
  }
  return result;
}

const query = service("query");
const DEDUPE_WINDOW_MS = 5_000;

async function loadConversationView(channelId: string): Promise<ConversationViewData> {
  const data = await apiGet<{
    channel?: RawChannel;
    history?: { has_more?: boolean; messages?: RawMessage[] };
    users?: RawUser[];
  }>(`/api/channels/${channelId}/view`);
  if (!data.ok) throw new Error(data.error ?? "conversations.view failed");

  return {
    canvases: data.channel ? mapCanvasTabs(data.channel) : [],
    channel: data.channel
      ? mapChannel(data.channel)
      : {
          archived: false,
          id: channelId,
          name: channelId,
          private: true,
          topic: "",
          unread: false,
        },
    details: data.channel
      ? mapChannelDetails(data.channel)
      : {
          archived: false,
          created: 0,
          id: channelId,
          name: channelId,
          private: true,
          purpose: "",
          topic: "",
        },
    hasMore: !!data.history?.has_more,
    messages: mapVisibleMessages(data.history?.messages ?? []).reverse(),
    users: (data.users ?? []).filter((user) => user.id).map(mapUser),
  };
}

export function fetchConversationView(channelId: string): Promise<ConversationViewData> {
  return query.client.query({
    queryFn: () => loadConversationView(channelId),
    queryKey: conversationViewKey(channelId),
    staleTime: DEDUPE_WINDOW_MS,
  });
}

export async function fetchChannelCanvases(channelId: string): Promise<CanvasListItem[]> {
  return (await fetchConversationView(channelId)).canvases;
}
