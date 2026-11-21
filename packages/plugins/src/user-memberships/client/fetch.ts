import { apiGet, ifPresent, parseChannelId, parseUserId } from "@slock/slack";
import type { ChannelId, UserId } from "@slock/types";

export type MembershipKind = "public" | "private" | "mpim" | "im";

export type Membership = {
  id: ChannelId;
  kind: MembershipKind;
  name: string;
  userId?: UserId;
  created: boolean;
};

type RawMembership = Omit<Membership, "id" | "userId"> & { id: string; userId?: string };

export const MEMBERSHIPS_STALE_MS = 30 * 60_000;

export async function fetchMemberships(userId: UserId): Promise<Membership[]> {
  const data = await apiGet<{ memberships: RawMembership[] }>(`/api/users/${userId}/memberships`);
  if (!data.ok) throw new Error(data.error ?? "memberships lookup failed");
  return data.memberships.map((m) => ({
    ...m,
    id: parseChannelId(m.id),
    userId: ifPresent(parseUserId, m.userId),
  }));
}
