import type {
  BrowsableChannel,
  GlobalSearchResults,
  RawChannel,
  RawFile,
  RawUser,
} from "@slock/types";
import { apiGet, apiPost, canvasFileIdOf, mapFile, mapUser } from "@slock/types";

export function mapBrowsableChannels(items: RawChannel[]): BrowsableChannel[] {
  return items
    .filter(
      (channel) =>
        !(
          channel.is_archived ||
          channel.is_member ||
          channel.is_mpim ||
          channel.is_im ||
          channel.is_record_channel ||
          canvasFileIdOf(channel) ||
          channel.name?.startsWith("mpdm-")
        ),
    )
    .map((channel) => ({
      id: channel.id,
      memberCount: channel.member_count,
      name: channel.name ?? channel.id,
      private: !!channel.is_private,
      topic: typeof channel.topic === "string" ? channel.topic : (channel.topic?.value ?? ""),
    }));
}

export function saveSearchHistory(query: string): void {
  void apiPost("/api/search/save", { query }).catch(() => {});
}

export async function searchGlobal(query: string): Promise<GlobalSearchResults> {
  const data = await apiGet<{ channels?: RawChannel[]; files?: RawFile[]; users?: RawUser[] }>(
    `/api/search?query=${encodeURIComponent(query)}`,
  );
  if (!data.ok) throw new Error(data.error ?? "global search failed");
  return {
    channels: mapBrowsableChannels(data.channels ?? []),
    files: (data.files ?? []).map(mapFile),
    users: (data.users ?? []).map(mapUser),
  };
}
