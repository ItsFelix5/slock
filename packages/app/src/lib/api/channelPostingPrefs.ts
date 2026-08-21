import type { ChannelPostingPrefs, ChannelPostingPrefsPatch } from "@slock/types";
import { apiGet, apiPut } from "@slock/types";

const MAX_POSTING_EXCEPTIONS = 100;

function splitPrefValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(splitPrefValues);
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseAccessPref(value: unknown): {
  types: string[];
  userIds: string[];
} {
  if (typeof value === "string") {
    const parts = splitPrefValues(value);
    return {
      types: parts.filter((part) => part.startsWith("type:")).map((part) => part.slice(5)),
      userIds: parts.filter((part) => part.startsWith("user:")).map((part) => part.slice(5)),
    };
  }
  if (!(value && typeof value === "object")) return { types: ["ra"], userIds: [] };
  const access = value as { type?: unknown; user?: unknown };
  return {
    types: splitPrefValues(access.type).map((part) =>
      part.startsWith("type:") ? part.slice(5) : part,
    ),
    userIds: splitPrefValues(access.user).map((part) =>
      part.startsWith("user:") ? part.slice(5) : part,
    ),
  };
}

function parseEnabledPref(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value !== "false";
  if (value && typeof value === "object") {
    return parseEnabledPref((value as { enabled?: unknown }).enabled);
  }
  return true;
}

export function parseChannelPostingPrefs(value: unknown): ChannelPostingPrefs {
  let normalized = value;
  if (typeof normalized === "string") {
    try {
      normalized = JSON.parse(normalized);
    } catch {
      normalized = {};
    }
  }
  const prefs = (normalized && typeof normalized === "object" ? normalized : {}) as Record<
    string,
    unknown
  >;
  const posting = parseAccessPref(prefs.who_can_post);
  const threads = parseAccessPref(prefs.can_thread);
  return {
    allowChannelMentions:
      parseEnabledPref(prefs.enable_at_channel) && parseEnabledPref(prefs.enable_at_here),
    postingExceptionUserIds: [...new Set(posting.userIds)].slice(0, MAX_POSTING_EXCEPTIONS),
    postingRestrictedToManagers: posting.types.includes("admin"),
    threadsRestrictedToManagers: threads.types.includes("admin"),
  };
}

function serializeAccessPref(restricted: boolean, exceptionUserIds: string[] = []): string {
  if (!restricted) return "type:ra";
  const users = [...new Set(exceptionUserIds.filter(Boolean))]
    .slice(0, MAX_POSTING_EXCEPTIONS)
    .map((id) => `user:${id}`);
  return ["type:admin", ...users].join(",");
}

export function serializeChannelPostingPrefsPatch(
  patch: ChannelPostingPrefsPatch,
): Record<string, string> {
  if ("posting" in patch) {
    return {
      who_can_post: serializeAccessPref(
        patch.posting.restrictedToManagers,
        patch.posting.exceptionUserIds,
      ),
    };
  }
  if ("threadsRestrictedToManagers" in patch) {
    return {
      can_thread: serializeAccessPref(patch.threadsRestrictedToManagers),
    };
  }
  const enabled = String(patch.allowChannelMentions);
  return { enable_at_channel: enabled, enable_at_here: enabled };
}

export async function fetchChannelPostingPrefs(channelId: string): Promise<ChannelPostingPrefs> {
  const data = await apiGet(`/api/channels/${channelId}/posting-prefs`);
  if (!data.ok) throw new Error(data.error ?? "admin.conversations.getConversationPrefs failed");
  return parseChannelPostingPrefs(data.prefs ?? data);
}

export async function setChannelPostingPrefs(
  channelId: string,
  patch: ChannelPostingPrefsPatch,
): Promise<void> {
  const data = await apiPut(`/api/channels/${channelId}/posting-prefs`, {
    prefs: serializeChannelPostingPrefsPatch(patch),
  });
  if (!data.ok) throw new Error(data.error ?? "admin.conversations.setConversationPrefs failed");
}
