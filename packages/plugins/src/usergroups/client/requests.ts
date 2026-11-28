import { createBatchLoader, type FetchContext } from "@slock/resource";
import { ifPresent, parseChannelId, parseUserId, replyError } from "@slock/slack";
import { apiGet, apiPost } from "@slock/slack/client";
import type { RawUsergroup, Usergroup, UsergroupDetails, UserId } from "@slock/types";

const MAX_USERGROUPS_PER_BATCH = 100;

export function fetchUsergroup(id: string): Promise<Usergroup | null> {
  return fetchUsergroupRaw(id).then((raw) => mapUsergroup(raw) ?? null);
}

export async function fetchUsergroupDetails(
  id: string,
  context: FetchContext,
): Promise<UsergroupDetails | null> {
  const [raw, memberIds] = await Promise.all([
    fetchUsergroupRaw(id),
    fetchUsergroupMemberIds(id, context.signal),
  ]);
  const mapped = mapUsergroupDetails(raw);
  return mapped ? { ...mapped, memberIds } : null;
}

function mapUsergroup(raw: RawUsergroup | undefined): Usergroup | undefined {
  const label = raw?.handle || raw?.name;
  if (!(raw && label)) return;
  return { id: raw.id, name: label.startsWith("@") ? label : `@${label}` };
}

function mapUsergroupDetails(
  raw: RawUsergroup | undefined,
): Omit<UsergroupDetails, "memberIds"> | undefined {
  if (!raw) return;
  const channelIds = [
    ...new Set([...(raw.prefs?.channels ?? []), ...(raw.prefs?.groups ?? [])]),
  ].map(parseChannelId);
  return {
    channelIds,
    createdBy: ifPresent(parseUserId, raw.created_by),
    dateCreate: raw.date_create || undefined,
    description: raw.description ?? "",
    handle: raw.handle ?? "",
    id: raw.id,
    isSection: !!raw.is_section,
    memberCount: Number(raw.user_count ?? 0),
    title: raw.name ?? raw.handle ?? "",
  };
}

const fetchUsergroupRaw = createBatchLoader<RawUsergroup | undefined>({
  load: async (ids) => {
    const data = await apiPost<{ usergroups?: Record<string, RawUsergroup | null> }>(
      "/api/usergroups/lookup",
      { ids },
    );
    if (!data.ok) throw replyError(data, "edge usergroups/info failed");
    const usergroups = data.usergroups ?? {};
    return new Map(ids.map((id) => [id, usergroups[id] ?? undefined]));
  },
  maxBatch: MAX_USERGROUPS_PER_BATCH,
});

async function fetchUsergroupMemberIds(id: string, signal: AbortSignal): Promise<UserId[]> {
  const data = await apiGet<{ userIds?: string[] }>(`/api/usergroups/${id}/members`, signal);
  if (!data.ok) throw replyError(data, "usergroups.users.list failed");
  return (data.userIds ?? []).map(parseUserId);
}
