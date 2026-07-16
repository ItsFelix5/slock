import type { Usergroup } from "../types";
import { callSlackEdge } from "./relay";

function mapUsergroup(raw: any): Usergroup | undefined {
  if (typeof raw?.id !== "string") return;
  const label = raw.handle || raw.name;
  if (typeof label !== "string" || !label) return;
  return { id: raw.id, name: label.startsWith("@") ? label : `@${label}` };
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
