import type {
  ProfileFieldDef,
  RawBot,
  RawUser,
  RawUserProfile,
  User,
  UserProfile,
  UserStatus,
} from "@slock/types";
import {
  ApiError,
  apiGet,
  apiPost,
  apiPut,
  apiUpload,
  getOrCreateRetryablePromise,
  mapBot,
  mapCustomFields,
  mapProfileIdentity,
  mapStartDate,
  mapUser,
} from "@slock/types";
import { createBatchedIdFetcher } from "./cache/batchedIdFetcher";

const MAX_USERS_PER_BATCH = 100;
const MAX_PRESENCE_PER_BATCH = 50;
const SLACKBOT_BOT_ID = "B01";

const fetchCachedUser = createBatchedIdFetcher<User | null>(async (ids) => {
  const data = await apiPost<{ users?: Record<string, RawUser | null> }>("/api/users/lookup", {
    ids,
  });
  if (!data.ok) throw new Error(data.error ?? "edge users/info failed");
  const users = data.users ?? {};
  return new Map(ids.map((id) => [id, users[id] ? mapUser(users[id]) : null]));
}, MAX_USERS_PER_BATCH);

export function fetchUser(id: string): Promise<User | null> {
  if (id === SLACKBOT_BOT_ID) return Promise.resolve(null);

  if (id.startsWith("B")) {
    return apiGet<{ bot?: RawBot }>(`/api/bots/${id}`).then(async (data) => {
      if (!data.ok) throw new Error(data.error ?? "bots.info failed");
      if (!data.bot?.id) return null;
      const bot = mapBot(data.bot);
      if (!data.bot.user_id) return bot;
      const user = await fetchCachedUser(data.bot.user_id);
      return user
        ? {
            ...user,
            appId: user.appId || bot.appId,
            avatarUrl: user.avatarUrl || bot.avatarUrl,
            botId: user.botId || bot.botId,
          }
        : bot;
    });
  }

  return fetchCachedUser(id);
}

export async function fetchUserProfile(id: string): Promise<UserProfile> {
  const data = await apiGet<{ profile: RawUserProfile }>(`/api/users/${id}/profile`);
  if (!data.ok) throw new Error(data.error ?? "users.profile.get failed");
  return {
    customFields: mapCustomFields(data.profile),
    startDate: mapStartDate(data.profile),
  };
}

export async function fetchAccountIdentity(): Promise<{ name: string; avatarUrl?: string }> {
  const data = await apiGet<{ profile: RawUserProfile }>("/api/users/me/profile");
  if (!data.ok) throw new Error(data.error ?? "users.profile.get failed");
  return mapProfileIdentity(data.profile);
}

export async function fetchProfileFieldDefs(): Promise<ProfileFieldDef[]> {
  const data = await apiGet<{ fields?: ProfileFieldDef[] }>("/api/profile-fields");
  if (!data.ok) throw new ApiError(data.error ?? "team.profile.get failed", data.retry_after);
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
  const data = await apiUpload<{ profile?: RawUserProfile }>(`/api/profile/photo?${params}`, file);
  if (!data.ok) throw new Error(data.error ?? "users.setPhoto failed");
  return data.profile?.image_192 ?? data.profile?.image_72 ?? data.profile?.image_48;
}

export async function setPresence(presence: "auto" | "away"): Promise<void> {
  const data = await apiPut("/api/presence", { presence });
  if (!data.ok) throw new Error(data.error ?? "users.setPresence failed");
}

const userStatusCache = new Map<string, Promise<UserStatus>>();
export function fetchUserStatus(userId: string): Promise<UserStatus> {
  return getOrCreateRetryablePromise(userStatusCache, userId, async () => {
    const data = await apiGet<{ status: UserStatus }>(`/api/user-status/${userId}`);
    if (!data.ok) throw new Error(data.error ?? "user status lookup failed");
    return data.status;
  });
}

export const fetchUserPresence = createBatchedIdFetcher<"active" | "away" | null>(async (ids) => {
  const data = await apiPost<{ presence?: Record<string, "active" | "away" | null> }>(
    "/api/users/presence",
    { ids },
  );
  if (!data.ok) throw new Error(data.error ?? "users.getPresence failed");
  const presence = data.presence ?? {};
  return new Map(ids.map((id) => [id, presence[id] ?? null]));
}, MAX_PRESENCE_PER_BATCH);
