import type {
  CanvasListItem,
  ConversationViewData,
  RawChannel,
  RawMessage,
  RawUser,
} from "@slock/types";
import { apiGet, mapChannel, mapChannelDetails, mapUser, mapVisibleMessages } from "@slock/types";

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

const inFlight = new Map<string, Promise<ConversationViewData>>();
const recent = new Map<string, { data: ConversationViewData; expiresAt: number }>();
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

export function invalidateConversationView(channelId: string): void {
  recent.delete(channelId);
}

export function fetchConversationView(channelId: string): Promise<ConversationViewData> {
  const cached = recent.get(channelId);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
  const pending = inFlight.get(channelId);
  if (pending) return pending;

  const request = loadConversationView(channelId)
    .then((data) => {
      recent.set(channelId, { data, expiresAt: Date.now() + DEDUPE_WINDOW_MS });
      return data;
    })
    .finally(() => inFlight.delete(channelId));
  inFlight.set(channelId, request);
  return request;
}

export async function fetchChannelCanvases(channelId: string): Promise<CanvasListItem[]> {
  return (await fetchConversationView(channelId)).canvases;
}
