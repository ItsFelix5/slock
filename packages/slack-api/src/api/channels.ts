import type {
  BrowsableChannel,
  CanvasInfo,
  Channel,
  ChannelDetails,
  ChannelMembersPage,
  ChannelSection,
} from "../types";
import { extractChannelSections, mapUser } from "./mappers";
import { callSlack, callSlackEdge } from "./relay";

// Resolves channels we don't have locally (mentioned in a message but never joined,
// or not in this session's bootstrap) via Flaron, a public, CORS-open Slack workspace
// archive/lookup service — no auth or proxying needed.
export async function fetchFlaronChannel(id: string): Promise<Channel | null> {
  const res = await fetch(`https://flaron.halceon.dev/channel/${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!data.name) return null;
  // Flaron's own UI uses "no `counts` field" as its private/public signal (it can't
  // get member/bot counts for channels it doesn't have access to) — mirror that here
  // since the API doesn't expose an explicit is_private flag.
  return {
    id: data.id ?? id,
    name: data.name,
    private: !data.counts,
    topic: data.topic ?? "",
    unread: false,
  };
}

// conversations.list is permanently unavailable on Enterprise Grid workspaces
// (enterprise_is_restricted), so there's no way to page and cache a full channel
// directory. Instead we call the same search.modules.channels endpoint the real
// web client's "Browse channels" uses — a live search with no local caching needed.
export async function fetchBrowsableChannels(query: string): Promise<BrowsableChannel[]> {
  const q = query.trim();
  if (!q) return [];
  const data = await callSlack("search.modules.channels", {
    query: q,
    module: "channels",
    count: "40",
  });
  if (!data.ok) return [];
  const items: any[] = data.items ?? [];
  return items
    .filter((c) => !c.is_archived && !c.is_member)
    .map((c) => ({
      id: c.id,
      name: c.name,
      private: !!c.is_private,
      topic: c.topic?.value ?? "",
      memberCount: c.member_count,
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
    id: c.id,
    name: c.name,
    private: !!c.is_private,
    topic: c.topic?.value ?? "",
    purpose: c.purpose?.value ?? "",
    created: c.created ?? 0,
    creatorId: c.creator || undefined,
    memberCount: c.num_members,
    // Unverified guess at where "send emails to this channel" addresses would
    // live on the info payload — if the guess is wrong this stays undefined and
    // the UI simply hides the email row.
    email: c.properties?.channel_email_addresses?.[0]?.address || undefined,
  };
}

// conversations.members is enterprise_is_restricted on Grid workspaces, so
// this reads membership from the Edge API cache the way the official client
// does. `filter: "apps"` scopes the same endpoint to the channel's installed
// apps. NOTE: "admins" is also a valid filter value here but returns
// workspace/Enterprise admins present in the channel — a different thing
// from the channel-scoped "Channel Manager" role, which instead comes from
// admin.roles.entity.listAssignments (see fetchChannelManagerIds below).
export async function fetchChannelMembers(
  channelId: string,
  filter: "everyone" | "apps",
  marker?: string,
): Promise<ChannelMembersPage> {
  const data = await callSlackEdge("users/list", {
    channels: [channelId],
    filter,
    count: 50,
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

// admin.roles.entity.listAssignments — confirmed via a live client network
// capture (`_x_reason: "fetch-channel-managers"`). Returns every role
// assigned on the channel, each as `{role_id, users}`; role_id "Rl0A" showed
// up consistently across every channel tested and is the only role Slack
// assigns at the channel level here, so all users across the returned
// assignments are treated as channel managers rather than hard-coding that
// id (in case it's per-workspace). No pagination — the full set of manager
// ids comes back in one call.
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

// channels.prefs.set — confirmed via a live client network capture. `who_can_post`/
// `can_thread` take a comma-joined "type:X,user:Y,user:Z" string; "type:admin" is the
// "channel managers only" state. The "everyone can post" value wasn't in the capture
// (that capture only showed a restricted state) — "type:everyone" is an unverified
// guess at the reset value, consistent with how the `type` half of the enum reads.
export async function setChannelPostingPrefs(
  channelId: string,
  opts: {
    postingRestrictedToManagers: boolean;
    threadsRestrictedToManagers: boolean;
    allowChannelMentions: boolean;
  },
): Promise<void> {
  const prefs = {
    who_can_post: opts.postingRestrictedToManagers ? "type:admin" : "type:everyone",
    can_thread: opts.threadsRestrictedToManagers ? "type:admin" : "type:everyone",
    enable_at_here: String(opts.allowChannelMentions),
    enable_at_channel: String(opts.allowChannelMentions),
  };
  const data = await callSlack("channels.prefs.set", {
    channel_id: channelId,
    prefs: JSON.stringify(prefs),
  });
  if (!data.ok) throw new Error(data.error ?? "channels.prefs.set failed");
}

// conversations.setRetention — confirmed via a live client network capture
// (retention_type: 1, retention_duration: 4). The exact meaning of
// retention_type's other values isn't known; `null` days maps to type 0,
// which the capture's surrounding UI treated as "keep messages forever".
export async function setChannelRetention(channelId: string, days: number | null): Promise<void> {
  const data = await callSlack("conversations.setRetention", {
    channel: channelId,
    retention_type: days ? "1" : "0",
    retention_duration: String(days ?? 0),
  });
  if (!data.ok) throw new Error(data.error ?? "conversations.setRetention failed");
}

// conversations.permissions.accountTypes.set — confirmed via a live client
// network capture. Always sends the full permission set for FULL_MEMBER
// (matching the capture), since there's no known way to patch a single flag.
export async function setMemberPermissions(
  channelId: string,
  perms: { invite: boolean; setPurpose: boolean; setTopic: boolean },
): Promise<void> {
  const permissions = [
    { permission: "INVITE_TO_CHANNEL", is_allowed: perms.invite },
    { permission: "SET_CHANNEL_PURPOSE", is_allowed: perms.setPurpose },
    { permission: "SET_CHANNEL_TOPIC", is_allowed: perms.setTopic },
  ];
  const data = await callSlack("conversations.permissions.accountTypes.set", {
    channel_id: channelId,
    account_type: "FULL_MEMBER",
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
    topic: c.topic?.value ?? "",
    unread: false,
  };
}

export async function createChannel(name: string, isPrivate: boolean): Promise<Channel> {
  const data = await callSlack("conversations.create", {
    name,
    is_private: isPrivate ? "true" : "false",
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

export async function setChannelNotifyAll(channelId: string, notifyAll: boolean): Promise<void> {
  // Same private users.prefs.setNotifications mechanism as the real webapp's
  // per-channel "Notification preferences" menu — confirmed by round-tripping
  // a real channel: {name: desktop|mobile, value: "everything"} is the "all new
  // messages" override, "mentions_dms" is the no-override/default state.
  const value = notifyAll ? "everything" : "mentions_dms";
  const [desktop, mobile] = await Promise.all([
    callSlack("users.prefs.setNotifications", {
      name: "desktop",
      value,
      channel_id: channelId,
      global: "false",
    }),
    callSlack("users.prefs.setNotifications", {
      name: "mobile",
      value,
      channel_id: channelId,
      global: "false",
    }),
  ]);
  if (!desktop.ok || !mobile.ok) throw new Error("users.prefs.setNotifications failed");
}

export async function openDm(userId: string): Promise<string | null> {
  const data = await callSlack("conversations.open", { users: userId });
  if (!data.ok) return null;
  return data.channel?.id ?? null;
}

export async function closeDm(channelId: string) {
  const data = await callSlack("conversations.close", { channel: channelId });
  if (!data.ok) throw new Error(data.error ?? "conversations.close failed");
  return data;
}

export async function fetchSections(): Promise<ChannelSection[]> {
  try {
    const data = await callSlack("users.channelSections.list");
    if (!data.ok) return [];
    const sections = extractChannelSections(data);
    return (sections ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      channelIds: s.channelIds,
      type: s.type,
    }));
  } catch {
    return [];
  }
}

// The following section mutations are undocumented, unverified against a live
// workspace — param names are a best-effort guess from the shape
// users.channelSections.list itself returns. Each forwards Slack's raw response
// so a wrong guess surfaces as a real `error` field instead of failing silently.
export async function createSection(name: string): Promise<{ id: string; name: string } | null> {
  // type must be "standard" (the enum rejects "custom") and emoji is required, empty string is fine.
  const data = await callSlack("users.channelSections.create", {
    name,
    type: "standard",
    emoji: "",
  });
  if (!data.ok) return null;
  const created = data.channel_section ?? data;
  const id = created?.channel_section_id ?? created?.id;
  if (!id) return null;
  return { id, name: created?.name ?? name };
}

export async function renameSection(sectionId: string, name: string): Promise<boolean> {
  const data = await callSlack("users.channelSections.update", {
    channel_section_id: sectionId,
    name,
  });
  return !!data.ok;
}

export async function deleteSection(sectionId: string): Promise<boolean> {
  const data = await callSlack("users.channelSections.delete", { channel_section_id: sectionId });
  return !!data.ok;
}

// Confirmed via a live capture of the real Slack web client dragging a
// section: "users.channelSections.set" takes the section being moved plus
// the section it should now sit directly above ("next"). Omitting
// next_channel_section_id drops the section to the bottom of the list.
export async function reorderSection(
  sectionId: string,
  nextSectionId: string | null,
): Promise<boolean> {
  const data = await callSlack("users.channelSections.set", {
    channel_section_id: sectionId,
    ...(nextSectionId ? { next_channel_section_id: nextSectionId } : {}),
  });
  return !!data.ok;
}

export async function updateSectionChannels(
  sectionId: string,
  changes: { insertChannelIds?: string[]; removeChannelIds?: string[] },
): Promise<boolean> {
  // Confirmed via a live client network capture: the top-level params are
  // "insert"/"remove", each a JSON array of {channel_section_id, channel_ids} batches.
  const insert = changes.insertChannelIds?.length
    ? [{ channel_section_id: sectionId, channel_ids: changes.insertChannelIds }]
    : [];
  const remove = changes.removeChannelIds?.length
    ? [{ channel_section_id: sectionId, channel_ids: changes.removeChannelIds }]
    : [];
  const data = await callSlack("users.channelSections.channels.bulkUpdate", {
    insert: JSON.stringify(insert),
    remove: JSON.stringify(remove),
    _x_reason: "channel-sidebar-channel-drop",
  });
  return !!data.ok;
}
