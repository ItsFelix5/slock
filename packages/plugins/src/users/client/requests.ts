import { createBatchLoader, type FetchContext } from "@slock/resource";
import { mapCustomFields, mapStartDate, mapUser, parseUserId, replyError } from "@slock/slack";
import { apiGet, apiPost, apiPut, apiUpload } from "@slock/slack/client";
import type { RawBot, RawUser, RawUserProfile, User, UserId, UserProfile } from "@slock/types";

const MAX_USERS_PER_BATCH = 100;
const MAX_PRESENCE_PER_BATCH = 50;

export function fetchUser(id: string, context?: FetchContext): Promise<User | null> {
  if (id === "B01") return fetchCachedUser("USLACKBOT");

  if (id.startsWith("B"))
    return apiGet<{ bot?: RawBot }>(`/api/bots/${id}`, context?.signal).then(async (data) => {
      if (!data.ok) {
        if (data.error === "bot_not_found") return null;
        throw replyError(data, "bots.info failed");
      }
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

  return fetchCachedUser(id);
}

export async function fetchUserProfile(id: string, signal?: AbortSignal): Promise<UserProfile> {
  const data = await apiGet<{ profile: RawUserProfile }>(`/api/users/${id}/profile`, signal);
  if (!data.ok) throw replyError(data, "users.profile.get failed");
  return {
    customFields: mapCustomFields(data.profile),
    startDate: mapStartDate(data.profile),
  };
}

export async function setStatus(text: string, emoji: string, expiration: number): Promise<void> {
  const data = await apiPut("/api/profile", {
    profile: {
      status_emoji: emoji,
      status_expiration: expiration,
      status_text: text,
    },
  });
  if (!data.ok) throw replyError(data, "users.profile.set failed");
}

export async function setProfileFields(fields: {
  displayName?: string;
  fullName?: string;
  title?: string;
  pronouns?: string;
  customFields?: Record<string, string>;
}): Promise<void> {
  const profile: Record<string, unknown> = {};
  if (fields.displayName !== undefined) profile.display_name = fields.displayName;
  if (fields.fullName !== undefined) profile.real_name = fields.fullName;
  if (fields.title !== undefined) profile.title = fields.title;
  if (fields.pronouns !== undefined) profile.pronouns = fields.pronouns;
  if (fields.customFields) {
    profile.fields = Object.fromEntries(
      Object.entries(fields.customFields).map(([id, value]) => [id, { alt: "", value }]),
    );
  }
  const data = await apiPut("/api/profile", { profile });
  if (!data.ok) throw replyError(data, "users.profile.set failed");
}

export async function uploadProfilePhoto(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const params = new URLSearchParams({ filename: file.name, type: file.type });
  const data = await apiUpload<{ profile?: RawUserProfile }>(`/api/profile/photo?${params}`, file);
  if (!data.ok) throw replyError(data, "users.setPhoto failed");
  return data.profile?.image_192 ?? data.profile?.image_72 ?? data.profile?.image_48;
}

export async function setPresence(presence: "auto" | "away"): Promise<void> {
  const data = await apiPut("/api/presence", { presence });
  if (!data.ok) throw replyError(data, "users.setPresence failed");
}

export const fetchUserPresence = createBatchLoader<"active" | "away" | null, UserId>({
  load: async (ids) => {
    const data = await apiPost<{ presence?: Record<string, "active" | "away" | null> }>(
      "/api/users/presence",
      { ids },
    );
    if (!data.ok) throw replyError(data, "users.getPresence failed");
    const presence = data.presence ?? {};
    return new Map(ids.map((id) => [id, presence[id] ?? null]));
  },
  maxBatch: MAX_PRESENCE_PER_BATCH,
});

const fetchCachedUser = createBatchLoader<User | null>({
  load: async (ids) => {
    const data = await apiPost<{ users?: Record<string, RawUser | null> }>("/api/users/lookup", {
      ids,
    });
    if (!data.ok) throw replyError(data, "edge users/info failed");
    const users = data.users ?? {};
    return new Map(ids.map((id) => [id, users[id] ? mapUser(users[id]) : null]));
  },
  maxBatch: MAX_USERS_PER_BATCH,
});

export async function searchDirectory(
  query: string,
): Promise<{ users: User[]; truncated: boolean }> {
  const q = query.trim();
  if (!q) return { truncated: false, users: [] };
  const data = await apiGet<{ truncated?: boolean; users?: RawUser[] }>(
    `/api/directory?query=${encodeURIComponent(q)}`,
  );
  if (!data.ok) throw replyError(data, "search.modules.people failed");
  return {
    truncated: !!data.truncated,
    users: (data.users ?? []).map(mapUser),
  };
}

export function mapBot(raw: RawBot): User {
  const rawIcon = raw.icons?.image_72 ?? raw.icons?.image_48 ?? raw.icons?.image_36;
  return {
    appId: raw.app_id || undefined,
    avatarColor: "#616061",
    avatarUrl: rawIcon || undefined,
    botId: raw.id,
    id: parseUserId(raw.id),
    isBot: true,
    name: raw.name ?? "",
  };
}
