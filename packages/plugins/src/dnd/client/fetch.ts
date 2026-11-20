import { apiGet } from "@slock/slack";

export async function fetchUserDnd(userId: string): Promise<number | null> {
  const data = await apiGet<{ pausedUntil: number | null }>(`/api/dnd/users/${userId}`);
  if (!data.ok) throw new Error(data.error ?? "dnd lookup failed");
  return data.pausedUntil;
}
