import type { UserStatus } from "@slock/types";
import { apiGet, getOrCreateRetryablePromise } from "@slock/types";

const userStatusCache = new Map<string, Promise<UserStatus>>();
export function fetchUserStatus(userId: string): Promise<UserStatus> {
  return getOrCreateRetryablePromise(userStatusCache, userId, async () => {
    const data = await apiGet(`/api/user-status/${userId}`);
    if (!data.ok) throw new Error(data.error ?? "user status lookup failed");
    return data.status as UserStatus;
  });
}
