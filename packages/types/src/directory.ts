import { mapUser } from "./mapUsers";
import type { RawUser } from "./rawTypes";
import { apiGet } from "./server";
import type { User } from "./userTypes";

export async function searchDirectory(
  query: string,
): Promise<{ users: User[]; truncated: boolean }> {
  const q = query.trim();
  if (!q) return { truncated: false, users: [] };
  const data = await apiGet<{ truncated?: boolean; users?: RawUser[] }>(
    `/api/directory?query=${encodeURIComponent(q)}`,
  );
  if (!data.ok) throw new Error(data.error ?? "search.modules.people failed");
  return {
    truncated: !!data.truncated,
    users: (data.users ?? []).map(mapUser),
  };
}
