import type { RawCountGroup, RawCounts } from "./rawTypes";

function parseCountGroup(
  g: RawCountGroup,
): { id: string; unread: boolean; mentions: number } | null {
  if (!g?.id) return null;

  const mentions = g.mention_count_display ?? g.mention_count ?? 0;
  const rawUnreadCount = g.unread_count_display ?? g.unread_count;
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
): Record<string, { unread: boolean; mentions: number }> {
  const map: Record<string, { unread: boolean; mentions: number }> = {};
  for (const g of groups) {
    const parsed = parseCountGroup(g);
    if (parsed) map[parsed.id] = { mentions: parsed.mentions, unread: parsed.unread };
  }
  return map;
}

export function buildUnreadMap(
  counts: RawCounts | undefined,
): Record<string, { unread: boolean; mentions: number }> {
  if (!counts) return {};
  return mapCountGroups([
    ...(counts.channels ?? []),
    ...(counts.mpims ?? []),
    ...(counts.ims ?? []),
  ]);
}

export function parseBadgeCounts(
  payload: (RawCounts & { badges?: RawCounts }) | undefined,
): Record<string, { unread: boolean; mentions: number }> {
  const source = payload?.badges ?? payload ?? {};
  return mapCountGroups([
    ...(source.channels ?? []),
    ...(source.mpims ?? []),
    ...(source.ims ?? []),
  ]);
}
