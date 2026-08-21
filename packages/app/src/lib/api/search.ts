import type { BrowsableChannel, GlobalSearchResults } from "@slock/types";
import { apiGet, mapFile, mapUser } from "@slock/types";

export function mapBrowsableChannels(items: any[]): BrowsableChannel[] {
  return items
    .filter(
      (channel) =>
        !(
          channel.is_archived ||
          channel.is_member ||
          channel.is_mpim ||
          channel.is_im ||
          channel.is_record_channel ||
          channel.name?.startsWith("mpdm-")
        ),
    )
    .map((channel) => ({
      id: channel.id,
      memberCount: channel.member_count,
      name: channel.name,
      private: !!channel.is_private,
      topic: typeof channel.topic === "string" ? channel.topic : (channel.topic?.value ?? ""),
    }));
}

export async function searchGlobal(query: string): Promise<GlobalSearchResults> {
  const data = await apiGet(`/api/search?query=${encodeURIComponent(query)}`);
  if (!data.ok) throw new Error(data.error ?? "global search failed");
  return {
    channels: mapBrowsableChannels(Array.isArray(data.channels) ? data.channels : []),
    files: Array.isArray(data.files) ? data.files.map(mapFile) : [],
    users: Array.isArray(data.users) ? data.users.map(mapUser) : [],
  };
}
