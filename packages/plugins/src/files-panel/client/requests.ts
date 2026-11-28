import { mapFile, parseTs, replyError } from "@slock/slack";
import { apiGet } from "@slock/slack/client";
import type { ChannelFilesAndLinks, ChannelId, RawFile, RawLink, SlackLink } from "@slock/types";

export async function searchChannelFilesAndLinks(
  channelId: ChannelId,
  channelName: string,
  query: string,
  page: number,
  signal: AbortSignal,
): Promise<ChannelFilesAndLinks> {
  const params = new URLSearchParams({
    channelName,
    page: String(page),
    query,
  });
  const data = await apiGet<{
    files?: RawFile[];
    filesTotal?: number;
    hasMore?: boolean;
    links?: RawLink[];
    linksTotal?: number;
  }>(`/api/channels/${channelId}/files-links?${params}`, signal);
  if (!data.ok) throw replyError(data, "channel files & links search failed");
  const files = data.files ?? [];
  const links = data.links ?? [];
  return {
    files: files.map(mapFile),
    filesTotal: data.filesTotal ?? files.length,
    hasMore: !!data.hasMore,
    links: links.map(mapLink),
    linksTotal: data.linksTotal ?? links.length,
  };
}

export function mapLink(raw: RawLink): SlackLink {
  return {
    iconUrl: raw.icon_url || undefined,
    thumbHeight: raw.thumb_height ?? undefined,
    thumbUrl: raw.thumb_url || undefined,
    thumbWidth: raw.thumb_width ?? undefined,
    title: raw.title,
    ts: parseTs(raw.timestamp),
    url: raw.url,
  };
}
