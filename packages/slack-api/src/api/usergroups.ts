// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { ChannelSection, Usergroup, UsergroupDetails } from "../types";
import { createBatchedIdFetcher } from "./cache/batchedIdFetcher";
import { callSlack, callSlackEdge } from "./server";

function mapUsergroup(raw: any): Usergroup | undefined {
  if (typeof raw?.id !== "string") return;
  const label = raw.handle || raw.name;
  if (typeof label !== "string" || !label) return;
  return { id: raw.id, name: label.startsWith("@") ? label : `@${label}` };
}

// memberIds isn't filled in here — usergroups/info only carries a count, not
// the member list (see fetchUsergroupMemberIds) — callers merge it in after.
function mapUsergroupDetails(raw: any): Omit<UsergroupDetails, "memberIds"> | undefined {
  if (typeof raw?.id !== "string") return;
  const channelIds = [raw.prefs?.channels, raw.prefs?.groups]
    .flatMap((ids) => (Array.isArray(ids) ? ids : []))
    .filter((id, index, ids): id is string => typeof id === "string" && ids.indexOf(id) === index);
  return {
    channelIds,
    createdBy: raw.created_by || undefined,
    dateCreate: raw.date_create || undefined,
    description: raw.description ?? "",
    handle: raw.handle ?? "",
    id: raw.id,
    isSection: !!raw.is_section,
    memberCount: Number(raw.user_count ?? 0),
    title: raw.name ?? raw.handle ?? "",
  };
}

const MAX_USERGROUPS_PER_BATCH = 100;

function cachedUsergroupForId(data: any, id: string): any | undefined {
  if (data.usergroups?.[id]) return data.usergroups[id];
  if (Array.isArray(data.usergroups)) return data.usergroups.find((group) => group.id === id);
  if (Array.isArray(data.results)) return data.results.find((group) => group.id === id);
  return data.usergroup?.id === id ? data.usergroup : undefined;
}

// Coalesce requests issued while a message list renders (each @usergroup
// mention resolves independently) into Edge cache batches, mirroring user
// lookup. The raw object already carries everything the details panel needs
// too (description, handle, prefs.channels, user_count) — see
// fetchUsergroupDetails — so both the light mention lookup and the rich
// details fetch share this one batched call instead of hitting Slack twice.
const fetchUsergroupRaw = createBatchedIdFetcher<any | undefined>(async (ids) => {
  const data = await callSlackEdge("usergroups/info", { ids });
  return new Map(ids.map((id) => [id, data.ok ? cachedUsergroupForId(data, id) : undefined]));
}, MAX_USERGROUPS_PER_BATCH);

export function fetchUsergroup(id: string): Promise<Usergroup | null> {
  return fetchUsergroupRaw(id).then((raw) => mapUsergroup(raw) ?? null);
}

export async function fetchUsergroupChannelSection(id: string): Promise<ChannelSection | null> {
  const details = mapUsergroupDetails(await fetchUsergroupRaw(id));
  if (!details?.isSection) return null;
  return {
    channelIds: details.channelIds,
    id: details.id,
    name: details.title,
    sidebar: "hid",
    type: "usergroup",
  };
}

// usergroups/info (above) has no member list, only a count — Slack's edge
// mention cache is optimized for rendering @mentions, not membership. The
// dedicated usergroups.users.list Web API call fills that one gap.
async function fetchUsergroupMemberIds(id: string): Promise<string[]> {
  const data = await callSlack("usergroups.users.list", { usergroup: id });
  if (!data.ok) throw new Error(data.error ?? "usergroups.users.list failed");
  return Array.isArray(data.users) ? data.users : [];
}

export async function fetchUsergroupDetails(id: string): Promise<UsergroupDetails | null> {
  const [raw, memberIds] = await Promise.all([fetchUsergroupRaw(id), fetchUsergroupMemberIds(id)]);
  const mapped = mapUsergroupDetails(raw);
  return mapped ? { ...mapped, memberIds } : null;
}

export async function updateUsergroupProfile(
  id: string,
  patch: { name?: string; handle?: string; description?: string },
): Promise<void> {
  const data = await callSlack("usergroups.update", {
    usergroup: id,
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.handle === undefined ? {} : { handle: patch.handle }),
    ...(patch.description === undefined ? {} : { description: patch.description }),
  });
  if (!data.ok) throw new Error(data.error ?? "usergroups.update failed");
}

// Slack has no add/remove member endpoint — usergroups.users.update replaces
// the whole membership list, so callers pass the full next set of ids.
export async function setUsergroupMembers(id: string, userIds: string[]): Promise<void> {
  const data = await callSlack("usergroups.users.update", {
    usergroup: id,
    users: userIds.join(","),
  });
  if (!data.ok) throw new Error(data.error ?? "usergroups.users.update failed");
}

// Same full-replacement shape as setUsergroupMembers, for the group's default channels.
export async function setUsergroupChannels(id: string, channelIds: string[]): Promise<void> {
  const data = await callSlack("usergroups.update", {
    channels: channelIds.join(","),
    usergroup: id,
  });
  if (!data.ok) throw new Error(data.error ?? "usergroups.update failed");
}

export async function setUsergroupSectionEnabled(id: string, enabled: boolean): Promise<void> {
  const data = await callSlack("usergroups.update", {
    enable_section: String(enabled),
    usergroup: id,
  });
  if (!data.ok) throw new Error(data.error ?? "usergroups.update failed");
}
