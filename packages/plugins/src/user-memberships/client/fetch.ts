import { apiGet } from "@slock/slack";

export type MembershipKind = "public" | "private" | "mpim" | "im";

export type Membership = {
  id: string;
  kind: MembershipKind;
  name: string;
  userId?: string;
  created: boolean;
};

export const MEMBERSHIPS_QUERY = "userMemberships";
export const MEMBERSHIPS_STALE_MS = 30 * 60_000;

export async function fetchMemberships(userId: string): Promise<Membership[]> {
  const data = await apiGet<{ memberships: Membership[] }>(`/api/users/${userId}/memberships`);
  if (!data.ok) throw new Error(data.error ?? "memberships lookup failed");
  return data.memberships;
}
