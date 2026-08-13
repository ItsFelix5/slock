import type { ProfileFieldDef, User, UserProfile } from "../../types";
import { createBatchedIdFetcher } from "../cache/batchedIdFetcher";
import { mapBot, mapCustomFields, mapStartDate, mapUser } from "../mappers";
import { apiGet, apiPost, apiPut, apiUpload } from "../server";

const MAX_USERS_PER_BATCH = 100;
const SLACKBOT_BOT_ID = "B01";

const fetchCachedUser = createBatchedIdFetcher<User | null>(async (ids) => {
  const data = await apiPost("/api/users/lookup", { ids });
  if (!data.ok) throw new Error(data.error ?? "edge users/info failed");
  const users: Record<string, any> = data.users ?? {};
  return new Map(ids.map((id) => [id, users[id] ? mapUser(users[id]) : null]));
}, MAX_USERS_PER_BATCH);

export function fetchUser(id: string): Promise<User | null> {
  if (id === SLACKBOT_BOT_ID) return Promise.resolve(null);

  if (id.startsWith("B")) {
    return apiGet(`/api/bots/${id}`).then((data) => {
      if (!data.ok) throw new Error(data.error ?? "bots.info failed");
      return data.bot?.id ? mapBot(data.bot) : null;
    });
  }

  return fetchCachedUser(id);
}

export async function fetchUserProfile(id: string): Promise<UserProfile> {
  const data = await apiGet(`/api/users/${id}/profile`);
  if (!data.ok) throw new Error(data.error ?? "users.profile.get failed");
  return {
    customFields: mapCustomFields(data.profile),
    startDate: mapStartDate(data.profile),
  };
}

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

export async function uploadProfilePhoto(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const params = new URLSearchParams({ filename: file.name, type: file.type });
  const data = await apiUpload<{
    error?: string;
    profile?: { image_192?: string; image_48?: string; image_72?: string };
  }>(`/api/profile/photo?${params}`, file);
  if (data.error) throw new Error(data.error);
  return data.profile?.image_192 ?? data.profile?.image_72 ?? data.profile?.image_48;
}

export async function setPresence(presence: "auto" | "away"): Promise<void> {
  const data = await apiPut("/api/presence", { presence });
  if (!data.ok) throw new Error(data.error ?? "users.setPresence failed");
}

export async function fetchUserPresence(id: string): Promise<"active" | "away" | null> {
  const data = await apiGet(`/api/users/${id}/presence`);
  if (!data.ok) return null;
  return data.presence === "away" ? "away" : "active";
}

export async function searchDirectory(
  query: string,
): Promise<{ users: User[]; truncated: boolean }> {
  const q = query.trim();
  if (!q) return { truncated: false, users: [] };
  const data = await apiGet(`/api/directory?query=${encodeURIComponent(q)}`);
  if (!data.ok) throw new Error(data.error ?? "search.modules.people failed");
  return {
    truncated: !!data.truncated,
    users: (data.users ?? []).map(mapUser),
  };
}
