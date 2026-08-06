import { getOrCreateRetryablePromise } from "../cache/retryablePromiseCache";
import { apiGet } from "../server";

export type UserStatus = "eligible" | "over_18" | "banned" | "unverified";

// Never changes while the tab is open, so a session-scoped cache (no TTL) is fine.
const userStatusCache = new Map<string, Promise<UserStatus>>();
export function fetchUserStatus(userId: string): Promise<UserStatus> {
  return getOrCreateRetryablePromise(userStatusCache, userId, async () => {
    const data = await apiGet(`/api/user-status/${userId}`);
    if (!data.ok) throw new Error(data.error ?? "user status lookup failed");
    return data.status as UserStatus;
  });
}
