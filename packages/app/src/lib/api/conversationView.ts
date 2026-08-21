import type { CanvasListItem, ChannelDetails, ConversationViewData } from "@slock/types";
import { apiGet, HIDE_SUBTYPES, mapChannel, mapMessage, mapUser } from "@slock/types";

function mapCanvasTabs(channel: any): CanvasListItem[] {
  const tabs: any[] = Array.isArray(channel?.properties?.tabs) ? channel.properties.tabs : [];
  const seen = new Set<string>();
  return tabs.flatMap((tab) => {
    const fileId = tab?.type === "canvas" ? tab.data?.file_id : undefined;
    if (!fileId || seen.has(fileId)) return [];
    seen.add(fileId);
    return [{ fileId, title: typeof tab.label === "string" ? tab.label.trim() : "" }];
  });
}

const inFlight = new Map<string, Promise<ConversationViewData>>();
const recent = new Map<string, { data: ConversationViewData; expiresAt: number }>();
const DEDUPE_WINDOW_MS = 5_000;

function mapChannelDetails(channel: any): ChannelDetails {
  return {
    archived: !!channel.is_archived,
    created: channel.created ?? 0,
    creatorId: channel.creator || undefined,
    email: channel.properties?.channel_email_addresses?.[0]?.address || undefined,
    id: channel.id,
    memberCount: channel.num_members,
    name: channel.name ?? channel.id,
    private: !!channel.is_private,
    purpose: typeof channel.purpose === "string" ? channel.purpose : (channel.purpose?.value ?? ""),
    topic: typeof channel.topic === "string" ? channel.topic : (channel.topic?.value ?? ""),
  };
}

async function loadConversationView(channelId: string): Promise<ConversationViewData> {
  const data = await apiGet(`/api/channels/${channelId}/view`);
  if (!data.ok) throw new Error(data.error ?? "conversations.view failed");
  const rawMessages: any[] = data.history?.messages ?? [];
  const rawUsers: any[] = data.users ?? [];

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
    messages: rawMessages
      .filter((message) => message.type === "message" && !HIDE_SUBTYPES.has(message.subtype))
      .map(mapMessage)
      .reverse(),
    users: rawUsers.filter((user) => user?.id).map(mapUser),
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
