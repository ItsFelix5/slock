import type { RawCountGroup, RawCounts } from "@slock/types";

function parseCountGroup(
  g: RawCountGroup,
  everyMessageMentions: boolean,
): { id: string; unread: boolean; mentions: number } | null {
  if (!g?.id) return null;

  const rawUnreadCount = g.unread_count_display ?? g.unread_count;
  const mentions =
    g.mention_count_display ??
    g.mention_count ??
    (everyMessageMentions ? Number(rawUnreadCount) || 0 : 0);
  const hasUnreadCount = rawUnreadCount !== undefined && rawUnreadCount !== null;
  const unreadCount = Number(rawUnreadCount) || 0;
  const fallbackFlag = g.is_unread ?? g.has_unreads;
  const unreadFromFlag =
    fallbackFlag === true || fallbackFlag === 1 || fallbackFlag === "true" || fallbackFlag === "1";
  const unread = mentions > 0 || (hasUnreadCount ? unreadCount > 0 : unreadFromFlag);
  return { id: g.id, mentions, unread };
}

function mapCountGroups(
  groups: RawCountGroup[],
  everyMessageMentions: boolean,
): Record<string, { unread: boolean; mentions: number }> {
  const map: Record<string, { unread: boolean; mentions: number }> = {};
  for (const g of groups) {
    const parsed = parseCountGroup(g, everyMessageMentions);
    if (parsed) map[parsed.id] = { mentions: parsed.mentions, unread: parsed.unread };
  }
  return map;
}

function mapAllCounts(source: RawCounts) {
  return {
    ...mapCountGroups([...(source.channels ?? []), ...(source.mpims ?? [])], false),
    ...mapCountGroups(source.ims ?? [], true),
  };
}

export function buildUnreadMap(
  counts: RawCounts | undefined,
): Record<string, { unread: boolean; mentions: number }> {
  if (!counts) return {};
  return mapAllCounts(counts);
}

export function parseBadgeCounts(
  payload: (RawCounts & { badges?: RawCounts }) | undefined,
): Record<string, { unread: boolean; mentions: number }> {
  const source = payload?.badges ?? payload ?? {};
  return mapAllCounts(source);
}
