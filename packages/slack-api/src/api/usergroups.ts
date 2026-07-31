// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { Usergroup, UsergroupDetails } from "../types";
import { callSlack, callSlackEdge } from "./relay";

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
  return {
    channelIds: Array.isArray(raw.prefs?.channels) ? raw.prefs.channels : [],
    createdBy: raw.created_by || undefined,
    dateCreate: raw.date_create || undefined,
    description: raw.description ?? "",
    handle: raw.handle ?? "",
    id: raw.id,
    memberCount: Number(raw.user_count ?? 0),
    title: raw.name ?? raw.handle ?? "",
  };
}

type UsergroupRequest = {
  reject: (reason?: unknown) => void;
  resolve: (raw: any | undefined) => void;
};

const pendingUsergroupRequests = new Map<string, UsergroupRequest[]>();
let usergroupBatchScheduled = false;
const MAX_USERGROUPS_PER_BATCH = 100;

function cachedUsergroupForId(data: any, id: string): any | undefined {
  if (data.usergroups?.[id]) return data.usergroups[id];
  if (Array.isArray(data.usergroups)) return data.usergroups.find((group) => group.id === id);
  if (Array.isArray(data.results)) return data.results.find((group) => group.id === id);
  return data.usergroup?.id === id ? data.usergroup : undefined;
}

async function flushUsergroupBatch(): Promise<void> {
  usergroupBatchScheduled = false;
  const requests = new Map(pendingUsergroupRequests);
  pendingUsergroupRequests.clear();
  const ids = [...requests.keys()];

  for (let start = 0; start < ids.length; start += MAX_USERGROUPS_PER_BATCH) {
    const batchIds = ids.slice(start, start + MAX_USERGROUPS_PER_BATCH);
    try {
      const data = await callSlackEdge("usergroups/info", { ids: batchIds });
      for (const id of batchIds) {
        const raw = data.ok ? cachedUsergroupForId(data, id) : undefined;
        for (const request of requests.get(id) ?? []) request.resolve(raw);
      }
    } catch (error) {
      for (const id of batchIds) {
        for (const request of requests.get(id) ?? []) request.reject(error);
      }
    }
  }
}

// Coalesce requests issued while a message list renders (each @usergroup
// mention resolves independently) into Edge cache batches, mirroring user
// lookup. The raw object already carries everything the details panel needs
// too (description, handle, prefs.channels, user_count) — see
// fetchUsergroupDetails — so both the light mention lookup and the rich
// details fetch share this one batched call instead of hitting Slack twice.
function fetchUsergroupRaw(id: string): Promise<any | undefined> {
  return new Promise((resolve, reject) => {
    const requests = pendingUsergroupRequests.get(id) ?? [];
    requests.push({ reject, resolve });
    pendingUsergroupRequests.set(id, requests);
    if (usergroupBatchScheduled) return;
    usergroupBatchScheduled = true;
    queueMicrotask(() => void flushUsergroupBatch());
  });
}

export function fetchUsergroup(id: string): Promise<Usergroup | null> {
  return fetchUsergroupRaw(id).then((raw) => mapUsergroup(raw) ?? null);
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
