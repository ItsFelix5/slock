import type { User } from "../types";
import { mapUser } from "./mappers";
import { callSlack } from "./relay";

// Org-wide member search via the same search.modules.people endpoint the real
// web client's people search uses — a live per-query search, so a 100k-member
// workspace never needs to be paged through and cached locally. Items come
// back as full user objects (id, profile.display_name, image_*, …) that
// mapUser already understands; deleted members are excluded server-side.
export async function searchDirectory(
  query: string,
): Promise<{ users: User[]; truncated: boolean }> {
  const q = query.trim();
  if (!q) return { truncated: false, users: [] };
  const data = await callSlack("search.modules.people", {
    count: "30",
    module: "people",
    query: q,
  });
  if (!data.ok) return { truncated: false, users: [] };
  const items: any[] = data.items ?? [];
  return {
    truncated: (data.pagination?.total_count ?? items.length) > items.length,
    users: items.map(mapUser),
  };
}
