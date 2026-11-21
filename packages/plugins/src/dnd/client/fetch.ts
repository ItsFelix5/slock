import { apiGet } from "@slock/slack";
import type { UserId } from "@slock/types";

export async function fetchUserDnd(userId: UserId): Promise<number | null> {
  const data = await apiGet<{ pausedUntil: number | null }>(`/api/dnd/users/${userId}`);
  if (!data.ok) throw new Error(data.error ?? "dnd lookup failed");
  return data.pausedUntil;
}
