import type { Channel, ChannelDetails, RawChannel, RawChannelSection } from "@slock/types";

const FILE_CHANNEL_PREFIX = "FC:";
const CANVAS_COMMENTS_LABEL = "Canvas comments";

export function canvasFileIdOf(raw: Pick<RawChannel, "id" | "is_file" | "name_normalized">) {
  const hosted = raw.is_file || raw.name_normalized?.startsWith(FILE_CHANNEL_PREFIX);
  return hosted ? `F${raw.id.slice(1)}` : undefined;
}

export function mapChannel(raw: RawChannel): Channel {
  const canvasFileId = canvasFileIdOf(raw);
  return {
    archived: !!raw.is_archived,
    canvasFileId,
    id: raw.id,
    lastActivity: raw.latest ? Number.parseFloat(raw.latest) * 1000 : undefined,
    memberCount: raw.num_members ?? raw.member_count,
    name: canvasFileId ? CANVAS_COMMENTS_LABEL : (raw.name ?? raw.id),
    private: !!raw.is_private,
    topic: typeof raw.topic === "string" ? raw.topic : (raw.topic?.value ?? ""),
    unread: (raw.unread_count_display ?? raw.unread_count ?? 0) > 0,
  };
}

export function mapChannelDetails(raw: RawChannel): ChannelDetails {
  return {
    archived: !!raw.is_archived,
    created: raw.created ?? 0,
    creatorId: raw.creator || undefined,
    email: raw.properties?.channel_email_addresses?.[0]?.address || undefined,
    id: raw.id,
    memberCount: raw.num_members,
    name: canvasFileIdOf(raw) ? CANVAS_COMMENTS_LABEL : (raw.name ?? raw.id),
    private: !!raw.is_private,
    purpose: typeof raw.purpose === "string" ? raw.purpose : (raw.purpose?.value ?? ""),
    topic: typeof raw.topic === "string" ? raw.topic : (raw.topic?.value ?? ""),
  };
}

interface ChannelSectionSummary {
  channelIds: string[];
  id: string;
  name: string;
  sidebar: "hid" | "active" | "all";
  type: string;
}

export function extractChannelSections(
  data: { channel_sections?: RawChannelSection[] } | undefined,
): ChannelSectionSummary[] | null {
  const raw = data?.channel_sections;
  if (!Array.isArray(raw)) return null;

  return raw
    .map((s) => ({
      channelIds: s.channel_ids ?? s.channel_ids_page?.channel_ids ?? s.channels ?? [],
      id: s.channel_section_id ?? s.id ?? s.name,
      name: s.name ?? "Section",

      sidebar: s.sidebar === "all" || s.sidebar === "active" ? s.sidebar : ("hid" as const),
      type: s.type ?? "standard",
    }))
    .filter((s): s is ChannelSectionSummary => !!s.id);
}
