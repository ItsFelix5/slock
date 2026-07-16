// biome-ignore-all lint/performance/noBarrelFile: Channel-section functions are public API exports.
// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
// biome-ignore-all lint/style/noExcessiveLinesPerFile: Channel operations share serialization rules and a single public API surface.
import type {
  BrowsableChannel,
  CanvasInfo,
  Channel,
  ChannelDetails,
  ChannelMembersPage,
} from "../../types";
import { mapUser } from "../mappers";
import { callSlack, callSlackEdge } from "../relay";

export {
  createSection,
  deleteSection,
  fetchSections,
  openDm,
  renameSection,
  reorderSection,
  setChannelNotifyAll,
  setSectionSidebar,
  updateSectionChannels,
} from "./channelSections";
export async function fetchFlaronChannel(id: string): Promise<Channel | null> {
  const res = await fetch(`https://flaron.halceon.dev/channel/${encodeURIComponent(id)}`);
  if (!(res.ok && res.headers.get("content-type")?.includes("application/json"))) return null;
  const data = await res.json();
  if (!data.name) return null;
  return {
    id: data.id ?? id,
    name: data.name,
    private: !data.counts,
    topic: data.topic ?? "",
    unread: false,
  };
}
export async function fetchBrowsableChannels(query: string): Promise<BrowsableChannel[]> {
  const q = query.trim();
  if (!q) return [];
  const data = await callSlack("search.modules.channels", {
    count: "40",
    module: "channels",
    query: q,
  });
  if (!data.ok) return [];
  const items: any[] = data.items ?? [];
  return items
    .filter((c) => !(c.is_archived || c.is_member))
    .map((c) => ({
      id: c.id,
      memberCount: c.member_count,
      name: c.name,
      private: !!c.is_private,
      topic: typeof c.topic === "string" ? c.topic : (c.topic?.value ?? ""),
    }));
}
export async function fetchChannelCanvasInfo(channelId: string): Promise<CanvasInfo | null> {
  const data = await callSlack("conversations.info", { channel: channelId });
  const canvas = data?.channel?.properties?.canvas;
  return canvas?.file_id ? { fileId: canvas.file_id, isEmpty: !!canvas.is_empty } : null;
}
export async function fetchChannelDetails(channelId: string): Promise<ChannelDetails> {
  const data = await callSlack("conversations.info", {
    channel: channelId,
    include_num_members: "true",
  });
  if (!data.ok) throw new Error(data.error ?? "conversations.info failed");
  const c = data.channel;
  return {
    created: c.created ?? 0,
    creatorId: c.creator || undefined,
    email: c.properties?.channel_email_addresses?.[0]?.address || undefined,
    id: c.id,
    memberCount: c.num_members,
    name: c.name,
    private: !!c.is_private,
    purpose: c.purpose?.value ?? "",
    topic: typeof c.topic === "string" ? c.topic : (c.topic?.value ?? ""),
  };
}
export async function fetchChannelMembers(
  channelId: string,
  filter: "everyone" | "apps",
  marker?: string,
): Promise<ChannelMembersPage> {
  const data = await callSlackEdge("users/list", {
    channels: [channelId],
    count: 50,
    filter,
    present_first: false,
    ...(marker ? { marker } : {}),
  });
  if (!data.ok) throw new Error(data.error ?? "edge users/list failed");
  const results: any[] = data.results ?? [];
  return {
    members: results.filter((u) => !u.deleted).map(mapUser),
    nextCursor: data.next_marker || undefined,
  };
}
export async function fetchChannelManagerIds(channelId: string): Promise<string[]> {
  const data = await callSlack("admin.roles.entity.listAssignments", { entity_id: channelId });
  if (!data.ok) throw new Error(data.error ?? "admin.roles.entity.listAssignments failed");
  const assignments: any[] = data.role_assignments ?? [];
  return [...new Set(assignments.flatMap((a) => a.users ?? []))];
}
export async function inviteToChannel(channelId: string, userIds: string[]): Promise<void> {
  const data = await callSlack("conversations.invite", {
    channel: channelId,
    users: userIds.join(","),
  });
  if (!data.ok) throw new Error(data.error ?? "conversations.invite failed");
}
export async function removeFromChannel(channelId: string, userId: string): Promise<void> {
  const data = await callSlack("conversations.kick", { channel: channelId, user: userId });
  if (!data.ok) throw new Error(data.error ?? "conversations.kick failed");
}
export async function renameChannel(channelId: string, name: string): Promise<string> {
  const data = await callSlack("conversations.rename", { channel: channelId, name });
  if (!data.ok) throw new Error(data.error ?? "conversations.rename failed");
  return data.channel?.name ?? name;
}
export async function setChannelPurpose(channelId: string, purpose: string): Promise<void> {
  const data = await callSlack("conversations.setPurpose", { channel: channelId, purpose });
  if (!data.ok) throw new Error(data.error ?? "conversations.setPurpose failed");
}

export interface ChannelPostingPrefs {
  allowChannelMentions: boolean;
  postingExceptionUserIds: string[];
  postingRestrictedToManagers: boolean;
  threadsRestrictedToManagers: boolean;
}

export type ChannelPostingPrefsPatch =
  | {
      posting: {
        exceptionUserIds: string[];
        restrictedToManagers: boolean;
      };
    }
  | { threadsRestrictedToManagers: boolean }
  | { allowChannelMentions: boolean };

const MAX_POSTING_EXCEPTIONS = 100;

function splitPrefValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(splitPrefValues);
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseAccessPref(value: unknown): { types: string[]; userIds: string[] } {
  if (typeof value === "string") {
    const parts = splitPrefValues(value);
    return {
      types: parts.filter((part) => part.startsWith("type:")).map((part) => part.slice(5)),
      userIds: parts.filter((part) => part.startsWith("user:")).map((part) => part.slice(5)),
    };
  }
  if (!(value && typeof value === "object")) return { types: ["ra"], userIds: [] };
  const access = value as { type?: unknown; user?: unknown };
  return {
    types: splitPrefValues(access.type).map((part) =>
      part.startsWith("type:") ? part.slice(5) : part,
    ),
    userIds: splitPrefValues(access.user).map((part) =>
      part.startsWith("user:") ? part.slice(5) : part,
    ),
  };
}

function parseEnabledPref(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value !== "false";
  if (value && typeof value === "object") {
    return parseEnabledPref((value as { enabled?: unknown }).enabled);
  }
  return true;
}

export function parseChannelPostingPrefs(value: unknown): ChannelPostingPrefs {
  let normalized = value;
  if (typeof normalized === "string") {
    try {
      normalized = JSON.parse(normalized);
    } catch {
      normalized = {};
    }
  }
  const prefs = (normalized && typeof normalized === "object" ? normalized : {}) as Record<
    string,
    unknown
  >;
  const posting = parseAccessPref(prefs.who_can_post);
  const threads = parseAccessPref(prefs.can_thread);
  return {
    allowChannelMentions:
      parseEnabledPref(prefs.enable_at_channel) && parseEnabledPref(prefs.enable_at_here),
    postingExceptionUserIds: [...new Set(posting.userIds)].slice(0, MAX_POSTING_EXCEPTIONS),
    postingRestrictedToManagers: posting.types.includes("admin"),
    threadsRestrictedToManagers: threads.types.includes("admin"),
  };
}

function serializeAccessPref(restricted: boolean, exceptionUserIds: string[] = []): string {
  if (!restricted) return "type:ra";
  const users = [...new Set(exceptionUserIds.filter(Boolean))]
    .slice(0, MAX_POSTING_EXCEPTIONS)
    .map((id) => `user:${id}`);
  return ["type:admin", ...users].join(",");
}

export function serializeChannelPostingPrefsPatch(
  patch: ChannelPostingPrefsPatch,
): Record<string, string> {
  if ("posting" in patch) {
    return {
      who_can_post: serializeAccessPref(
        patch.posting.restrictedToManagers,
        patch.posting.exceptionUserIds,
      ),
    };
  }
  if ("threadsRestrictedToManagers" in patch) {
    return { can_thread: serializeAccessPref(patch.threadsRestrictedToManagers) };
  }
  const enabled = String(patch.allowChannelMentions);
  return { enable_at_channel: enabled, enable_at_here: enabled };
}

export async function fetchChannelPostingPrefs(channelId: string): Promise<ChannelPostingPrefs> {
  const data = await callSlack("channels.prefs.get", { channel_id: channelId });
  if (!data.ok) throw new Error(data.error ?? "channels.prefs.get failed");
  return parseChannelPostingPrefs(data.prefs ?? data);
}

export async function setChannelPostingPrefs(
  channelId: string,
  patch: ChannelPostingPrefsPatch,
): Promise<void> {
  const data = await callSlack("channels.prefs.set", {
    channel_id: channelId,
    prefs: JSON.stringify(serializeChannelPostingPrefsPatch(patch)),
  });
  if (!data.ok) throw new Error(data.error ?? "channels.prefs.set failed");
}
export async function setChannelRetention(channelId: string, days: number | null): Promise<void> {
  const data = await callSlack("conversations.setRetention", {
    channel: channelId,
    retention_duration: String(days ?? 0),
    retention_type: days ? "1" : "0",
  });
  if (!data.ok) throw new Error(data.error ?? "conversations.setRetention failed");
}
export async function setMemberPermissions(
  channelId: string,
  perms: { invite: boolean; setPurpose: boolean; setTopic: boolean },
): Promise<void> {
  const permissions = [
    { is_allowed: perms.invite, permission: "INVITE_TO_CHANNEL" },
    { is_allowed: perms.setPurpose, permission: "SET_CHANNEL_PURPOSE" },
    { is_allowed: perms.setTopic, permission: "SET_CHANNEL_TOPIC" },
  ];
  const data = await callSlack("conversations.permissions.accountTypes.set", {
    account_type: "FULL_MEMBER",
    channel_id: channelId,
    permissions: JSON.stringify(permissions),
  });
  if (!data.ok) throw new Error(data.error ?? "conversations.permissions.accountTypes.set failed");
}
export async function joinChannel(channelId: string): Promise<Channel> {
  const data = await callSlack("conversations.join", { channel: channelId });
  if (!data.ok) throw new Error(data.error ?? "conversations.join failed");
  const c = data.channel;
  return {
    id: c.id,
    name: c.name,
    private: !!c.is_private,
    topic: typeof c.topic === "string" ? c.topic : (c.topic?.value ?? ""),
    unread: false,
  };
}
export async function createChannel(name: string, isPrivate: boolean): Promise<Channel> {
  const data = await callSlack("conversations.create", {
    is_private: isPrivate ? "true" : "false",
    name,
  });
  if (!data.ok) throw new Error(data.error ?? "conversations.create failed");
  const c = data.channel;
  return { id: c.id, name: c.name, private: !!c.is_private, topic: "", unread: false };
}
export async function leaveChannel(channelId: string) {
  const data = await callSlack("conversations.leave", { channel: channelId });
  if (!data.ok) throw new Error(data.error ?? "conversations.leave failed");
  return data;
}
export async function setChannelTopic(channelId: string, topic: string): Promise<void> {
  const data = await callSlack("conversations.setTopic", { channel: channelId, topic });
  if (!data.ok) throw new Error(data.error ?? "conversations.setTopic failed");
}
