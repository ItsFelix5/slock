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
  if (!q) return { users: [], truncated: false };
  const data = await callSlack("search.modules.people", {
    query: q,
    module: "people",
    count: "30",
  });
  if (!data.ok) return { users: [], truncated: false };
  const items: any[] = data.items ?? [];
  return {
    users: items.map(mapUser),
    truncated: (data.pagination?.total_count ?? items.length) > items.length,
  };
}
