// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { ProfileFieldDef, User, UserCustomField } from "../../types";
import { createBatchedIdFetcher } from "../cache/batchedIdFetcher";
import { mapBot, mapCustomFields, mapUser } from "../mappers";
import { apiGet, apiPost, apiPut } from "../server";

// Keep JSON request bodies comfortably below the server limit even when
// a channel or search result renders thousands of previously unseen authors.
const MAX_USERS_PER_BATCH = 100;

const fetchCachedUser = createBatchedIdFetcher<User | null>(async (ids) => {
  const data = await apiPost("/api/users/lookup", { ids });
  if (!data.ok) throw new Error(data.error ?? "edge users/info failed");
  const users: Record<string, any> = data.users ?? {};
  return new Map(ids.map((id) => [id, users[id] ? mapUser(users[id]) : null]));
}, MAX_USERS_PER_BATCH);

export function fetchUser(id: string): Promise<User | null> {
  // A message can contain only bot_id/app_id, without the inline bot_profile
  // that normally supplies its display name and avatar. Bot IDs are not valid
  // inputs to the users cache endpoint, so resolve them through bots.info.
  if (id.startsWith("B")) {
    return apiGet(`/api/bots/${id}`).then((data) => {
      if (!data.ok) throw new Error(data.error ?? "bots.info failed");
      return data.bot?.id ? mapBot(data.bot) : null;
    });
  }
  // The normal Web API users.info endpoint is restricted on Enterprise Grid.
  // Coalesce all requests issued in this event-loop turn into one cache call.
  return fetchCachedUser(id);
}

// The batched users/lookup cache above never carries custom field *values* for
// anyone (self included) — only this full per-user fetch does, so it's called
// on demand when the profile panel actually needs them.
export async function fetchUserCustomFields(id: string): Promise<UserCustomField[] | undefined> {
  const data = await apiGet(`/api/users/${id}/profile`);
  if (!data.ok) throw new Error(data.error ?? "users.profile.get failed");
  return mapCustomFields(data.profile);
}

// team.profile.get's field *definitions* (label/ordering) are workspace-wide and
// separate from each user's field *values* (see mapUser's customFields) — fetched
// once and joined against a user's values at render time. Failures must stay
// distinguishable from a workspace that genuinely has no custom fields so the UI
// can offer a retry instead of silently hiding profile data.
export async function fetchProfileFieldDefs(): Promise<ProfileFieldDef[]> {
  const data = await apiGet("/api/profile-fields");
  if (!data.ok) throw new Error(data.error ?? "team.profile.get failed");
  return data.fields ?? [];
}

export async function setStatus(text: string, emoji: string, expiration: number): Promise<void> {
  const data = await apiPut("/api/profile", {
    profile: {
      status_emoji: emoji,
      status_expiration: expiration,
      status_text: text,
    },
  });
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
  const data = await apiPut("/api/profile", { profile });
  if (!data.ok) throw new Error(data.error ?? "users.profile.set failed");
}

export async function setPresence(presence: "auto" | "away"): Promise<void> {
  const data = await apiPut("/api/presence", { presence });
  if (!data.ok) throw new Error(data.error ?? "users.setPresence failed");
}

// Passive presence_change gateway events only ever arrive for people already
// in your DM/sidebar list — this queries Slack directly for anyone else,
// used when a profile is actually opened.
export async function fetchUserPresence(id: string): Promise<"active" | "away" | null> {
  const data = await apiGet(`/api/users/${id}/presence`);
  if (!data.ok) return null;
  return data.presence === "away" ? "away" : "active";
}

// Org-wide member search via the same search.modules.people endpoint the real
// web client's people search uses — a live per-query search, so a 100k-member
// workspace never needs to be paged through and cached locally.
export async function searchDirectory(
  query: string,
): Promise<{ users: User[]; truncated: boolean }> {
  const q = query.trim();
  if (!q) return { truncated: false, users: [] };
  const data = await apiGet(`/api/directory?query=${encodeURIComponent(q)}`);
  if (!data.ok) throw new Error(data.error ?? "search.modules.people failed");
  return { truncated: !!data.truncated, users: (data.users ?? []).map(mapUser) };
}
