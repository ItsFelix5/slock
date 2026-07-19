// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { Usergroup, UsergroupDetails } from "../types";
import { callSlack, callSlackEdge } from "./relay";

function mapUsergroup(raw: any): Usergroup | undefined {
  if (typeof raw?.id !== "string") return;
  const label = raw.handle || raw.name;
  if (typeof label !== "string" || !label) return;
  return { id: raw.id, name: label.startsWith("@") ? label : `@${label}` };
}

function mapUsergroupDetails(raw: any): UsergroupDetails | undefined {
  if (typeof raw?.id !== "string") return;
  return {
    channelIds: Array.isArray(raw.prefs?.channels) ? raw.prefs.channels : [],
    createdBy: raw.created_by || undefined,
    dateCreate: raw.date_create || undefined,
    description: raw.description ?? "",
    handle: raw.handle ?? "",
    id: raw.id,
    memberCount: Number(raw.user_count ?? raw.users?.length ?? 0),
    memberIds: Array.isArray(raw.users) ? raw.users : [],
    title: raw.name ?? raw.handle ?? "",
  };
}

type UsergroupRequest = {
  reject: (reason?: unknown) => void;
  resolve: (usergroup: Usergroup | null) => void;
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
        const usergroup = data.ok ? mapUsergroup(cachedUsergroupForId(data, id)) : undefined;
        for (const request of requests.get(id) ?? []) request.resolve(usergroup ?? null);
      }
    } catch (error) {
      for (const id of batchIds) {
        for (const request of requests.get(id) ?? []) request.reject(error);
      }
    }
  }
}

// Rich-text usergroup elements contain only an ID. Coalesce requests issued
// while a message list renders into Edge cache batches, mirroring user lookup.
export function fetchUsergroup(id: string): Promise<Usergroup | null> {
  return new Promise((resolve, reject) => {
    const requests = pendingUsergroupRequests.get(id) ?? [];
    requests.push({ reject, resolve });
    pendingUsergroupRequests.set(id, requests);
    if (usergroupBatchScheduled) return;
    usergroupBatchScheduled = true;
    queueMicrotask(() => void flushUsergroupBatch());
  });
}

// Slack has no per-id usergroup lookup for the full record (description,
// members, default channels) — only the edge mention cache above, which
// omits them. usergroups.list is the same call the real client makes to
// populate its usergroup directory, so this pulls the whole workspace list
// and picks out the one requested.
//
// ensureUsergroupDetails guards against refetching a *cached* id, but several
// distinct @usergroup mentions can still resolve on the same render (e.g. a
// message pinging multiple groups), each requesting a different id before
// any of them are cached — without sharing the in-flight list request, that
// fans out into one identical usergroups.list call per id.
let pendingListRequest: Promise<any> | null = null;
function fetchUsergroupsList(): Promise<any> {
  if (!pendingListRequest) {
    pendingListRequest = callSlack("usergroups.list", {
      include_count: "true",
      include_users: "true",
    }).finally(() => {
      pendingListRequest = null;
    });
  }
  return pendingListRequest;
}

export async function fetchUsergroupDetails(id: string): Promise<UsergroupDetails | null> {
  const data = await fetchUsergroupsList();
  if (!data.ok) throw new Error(data.error ?? "usergroups.list failed");
  const raw: any[] = data.usergroups ?? [];
  const found = raw.find((group) => group.id === id);
  return found ? (mapUsergroupDetails(found) ?? null) : null;
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
