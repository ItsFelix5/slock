// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
// biome-ignore-all lint/style/noExcessiveLinesPerFile: Account APIs share request and mapping helpers that are clearer when kept together.
import type { ProfileFieldDef, User } from "../../types";
import { mapBot, mapUser } from "../mappers";
import { callSlack, callSlackEdge } from "../relay";

type UserRequest = {
  reject: (reason?: unknown) => void;
  resolve: (user: User | null) => void;
};

const pendingUserRequests = new Map<string, UserRequest[]>();
let userBatchScheduled = false;
// Keep JSON request bodies comfortably below the relay/server limit even when
// a channel or search result renders thousands of previously unseen authors.
const MAX_USERS_PER_BATCH = 100;

function cachedUserForId(data: any, id: string): any | undefined {
  if (data.users?.[id]) return data.users[id];
  if (Array.isArray(data.results)) return data.results.find((user) => user.id === id);
  if (Array.isArray(data.users)) return data.users.find((user) => user.id === id);
  return data.user?.id === id ? data.user : undefined;
}

async function flushUserBatch(): Promise<void> {
  userBatchScheduled = false;
  const requests = new Map(pendingUserRequests);
  pendingUserRequests.clear();
  const ids = [...requests.keys()];
  if (!ids.length) return;

  for (let start = 0; start < ids.length; start += MAX_USERS_PER_BATCH) {
    const batchIds = ids.slice(start, start + MAX_USERS_PER_BATCH);
    try {
      // The cache endpoint accepts the IDs it should refresh as a timestamp map;
      // zero deliberately requests the complete current record.
      const data = await callSlackEdge("users/info", {
        include_profile_only_users: true,
        updated_ids: Object.fromEntries(batchIds.map((id) => [id, 0])),
      });
      for (const id of batchIds) {
        const user = data.ok ? cachedUserForId(data, id) : undefined;
        for (const request of requests.get(id) ?? []) request.resolve(user ? mapUser(user) : null);
      }
    } catch (error) {
      for (const id of batchIds) {
        for (const request of requests.get(id) ?? []) request.reject(error);
      }
    }
  }
}

export function fetchUser(id: string): Promise<User | null> {
  // A message can contain only bot_id/app_id, without the inline bot_profile
  // that normally supplies its display name and avatar. Bot IDs are not valid
  // inputs to the users cache endpoint, so resolve them through bots.info.
  if (id.startsWith("B")) {
    return callSlack("bots.info", { bot: id }).then((data) =>
      data.ok && data.bot?.id ? mapBot(data.bot) : null,
    );
  }
  // The normal Web API users.info endpoint is restricted on Enterprise Grid.
  // Coalesce all requests issued in this event-loop turn into one cache call.
  return new Promise((resolve, reject) => {
    const requests = pendingUserRequests.get(id) ?? [];
    requests.push({ reject, resolve });
    pendingUserRequests.set(id, requests);
    if (userBatchScheduled) return;
    userBatchScheduled = true;
    queueMicrotask(() => void flushUserBatch());
  });
}

// team.profile.get's field *definitions* (label/ordering) are workspace-wide and
// separate from each user's field *values* (see mapUser's customFields) — fetched
// once and joined against a user's values at render time. Some workspaces restrict
// this to admins, so a failure degrades to "no custom fields shown".
export async function fetchProfileFieldDefs(): Promise<ProfileFieldDef[]> {
  try {
    const data = await callSlack("team.profile.get");
    if (!data.ok) return [];
    const fields: any[] = data.profile?.fields ?? [];
    return fields
      .filter((f) => !f.is_hidden)
      .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
      .map((f) => ({ id: f.id, label: f.label }));
  } catch {
    return [];
  }
}

export async function setStatus(text: string, emoji: string, expiration: number): Promise<void> {
  const profile = JSON.stringify({
    status_emoji: emoji,
    status_expiration: expiration,
    status_text: text,
  });
  const data = await callSlack("users.profile.set", { profile });
  if (!data.ok) throw new Error(data.error ?? "users.profile.set failed");
}

export async function setProfileFields(fields: {
  displayName?: string;
  title?: string;
  pronouns?: string;
  customFields?: Record<string, string>;
}): Promise<void> {
  const profile: Record<string, unknown> = {};
  if (fields.displayName !== undefined) profile.display_name = fields.displayName;
  if (fields.title !== undefined) profile.title = fields.title;
  if (fields.pronouns !== undefined) profile.pronouns = fields.pronouns;
  if (fields.customFields) {
    profile.fields = Object.fromEntries(
      Object.entries(fields.customFields).map(([id, value]) => [id, { alt: "", value }]),
    );
  }
  const data = await callSlack("users.profile.set", { profile: JSON.stringify(profile) });
  if (!data.ok) throw new Error(data.error ?? "users.profile.set failed");
}

export async function setPresence(presence: "auto" | "away"): Promise<void> {
  const data = await callSlack("users.setPresence", { presence });
  if (!data.ok) throw new Error(data.error ?? "users.setPresence failed");
}

// Org-wide member search via the same search.modules.people endpoint the real
// web client's people search uses — a live per-query search, so a 100k-member
// workspace never needs to be paged through and cached locally. Items come
// back as full user objects (id, profile.display_name, image_*, …) that
// mapUser already understands; deleted members are excluded server-side.
export async function searchDirectory(
  query: string,
): Promise<{ users: User[]; truncated: boolean }> {
  const q = query.trim();
  if (!q) return { truncated: false, users: [] };
  const data = await callSlack("search.modules.people", {
    count: "30",
    module: "people",
    query: q,
  });
  if (!data.ok) return { truncated: false, users: [] };
  const items: any[] = data.items ?? [];
  return {
    truncated: (data.pagination?.total_count ?? items.length) > items.length,
    users: items.map(mapUser),
  };
}
