import { mapUser } from "./mapUsers";
import { apiGet } from "./server";
import type { User } from "./types";

export async function searchDirectory(
  query: string,
): Promise<{ users: User[]; truncated: boolean }> {
  const q = query.trim();
  if (!q) return { truncated: false, users: [] };
  const data = await apiGet(`/api/directory?query=${encodeURIComponent(q)}`);
  if (!data.ok) throw new Error(data.error ?? "search.modules.people failed");
  return {
    truncated: !!data.truncated,
    users: (data.users ?? []).map(mapUser),
  };
}
