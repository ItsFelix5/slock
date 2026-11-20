import { apiGet, mapChannel, mapChannelDetails, mapUser, parseFileId } from "@slock/slack";
import type {
  CanvasListItem,
  ChannelId,
  ConversationViewData,
  RawChannel,
  RawUser,
} from "@slock/types";
import { defineQuery } from "../../../query/client/api";

function mapCanvasTabs(channel: RawChannel): CanvasListItem[] {
  const seen = new Set<string>();
  const result: CanvasListItem[] = [];
  const defaultFileId = channel.properties?.canvas?.file_id;
  if (defaultFileId) {
    seen.add(defaultFileId);
    result.push({ fileId: parseFileId(defaultFileId), title: "" });
  }
  for (const tab of channel.properties?.tabs ?? []) {
    const fileId = tab.type === "canvas" ? tab.data?.file_id : undefined;
    if (!fileId || seen.has(fileId)) continue;
    seen.add(fileId);
    result.push({ fileId: parseFileId(fileId), title: tab.label?.trim() ?? "" });
  }
  return result;
}

const DEDUPE_WINDOW_MS = 5_000;

async function loadConversationView(channelId: ChannelId): Promise<ConversationViewData> {
  const data = await apiGet<{
    channel?: RawChannel;
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
    users: (data.users ?? []).filter((user) => user.id).map(mapUser),
  };
}

const conversationView = defineQuery<ChannelId, ConversationViewData>({
  load: loadConversationView,
  maxAgeMs: DEDUPE_WINDOW_MS,
  name: "conversationView",
});

export function fetchConversationView(channelId: ChannelId): Promise<ConversationViewData> {
  return conversationView.ensure(channelId);
}

export async function fetchChannelCanvases(channelId: ChannelId): Promise<CanvasListItem[]> {
  return (await fetchConversationView(channelId)).canvases;
}
