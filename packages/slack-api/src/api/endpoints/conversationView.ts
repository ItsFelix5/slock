// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { CanvasListItem, Channel, ChannelDetails, Message, User } from "../../types";
import { HIDE_SUBTYPES, mapChannel, mapMessage, mapUser } from "../mappers";
import { apiGet } from "../server";

export interface ConversationViewData {
  canvases: CanvasListItem[];
  channel: Channel;
  details: ChannelDetails;
  hasMore: boolean;
  messages: Message[];
  users: User[];
}

const inFlight = new Map<string, Promise<ConversationViewData>>();
const recent = new Map<string, { data: ConversationViewData; expiresAt: number }>();
const DEDUPE_WINDOW_MS = 5_000;

function mapCanvasTabs(channel: any): CanvasListItem[] {
  const properties = channel?.properties;
  const tabs: any[] = Array.isArray(properties?.tabs) ? properties.tabs : (properties?.tabz ?? []);
  const seen = new Set<string>();
  return tabs.flatMap((tab) => {
    const fileId = tab?.type === "canvas" ? tab.data?.file_id : undefined;
    if (!fileId || seen.has(fileId)) return [];
    seen.add(fileId);
    return [{ fileId, title: typeof tab.label === "string" ? tab.label.trim() : "" }];
  });
}

function mapChannelDetails(channel: any): ChannelDetails {
  return {
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
  const canvases = mapCanvasTabs(data.channel);
  return {
    canvases,
    channel: {
      ...mapChannel(data.channel),
      canvas: canvases[0] ? { fileId: canvases[0].fileId, isEmpty: false } : undefined,
    },
    details: mapChannelDetails(data.channel),
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
