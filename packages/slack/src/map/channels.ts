import type { Channel, ChannelDetails, FileId, RawChannel } from "@slock/types";
import { hostedFileId, ifPresent, parseChannelId, parseUserId } from "../ids";

const FILE_CHANNEL_PREFIX = "FC:";
const CANVAS_COMMENTS_LABEL = "Canvas comments";

export function canvasFileIdOf(
  raw: Pick<RawChannel, "id" | "is_file" | "name_normalized">,
): FileId | undefined {
  const hosted = raw.is_file || raw.name_normalized?.startsWith(FILE_CHANNEL_PREFIX);
  return hosted ? hostedFileId(parseChannelId(raw.id)) : undefined;
}

function textValue(text: RawChannel["topic"]): string {
  return typeof text === "string" ? text : (text?.value ?? "");
}

function customGroupName(name: string | undefined): string | undefined {
  return name?.startsWith("mpdm-") ? undefined : name;
}

export function mapGroupDm(raw: RawChannel, selfId: string | undefined) {
  return {
    id: parseChannelId(raw.id),
    memberIds: (raw.members ?? []).filter((member) => member !== selfId).map(parseUserId),
    name: customGroupName(raw.name),
    topic: textValue(raw.topic),
  };
}

export function mapChannel(raw: RawChannel): Channel {
  const canvasFileId = canvasFileIdOf(raw);
  return {
    archived: !!raw.is_archived,
    canvasFileId,
    id: parseChannelId(raw.id),
    lastActivity: raw.latest ? Number.parseFloat(raw.latest) * 1000 : undefined,
    memberCount: raw.num_members ?? raw.member_count,
    name: canvasFileId ? CANVAS_COMMENTS_LABEL : (raw.name ?? raw.id),
    private: !!raw.is_private,
    topic: textValue(raw.topic),
    unread: (raw.unread_count_display ?? raw.unread_count ?? 0) > 0,
  };
}

export function mapChannelDetails(raw: RawChannel): ChannelDetails {
  const name = raw.is_mpim ? (customGroupName(raw.name) ?? "") : (raw.name ?? raw.id);
  return {
    archived: !!raw.is_archived,
    created: raw.created ?? 0,
    creatorId: ifPresent(parseUserId, raw.creator),
    email: raw.properties?.channel_email_addresses?.[0]?.address || undefined,
    id: parseChannelId(raw.id),
    memberCount: raw.num_members,
    name: canvasFileIdOf(raw) ? CANVAS_COMMENTS_LABEL : name,
    private: !!raw.is_private,
    purpose: textValue(raw.purpose),
    topic: textValue(raw.topic),
  };
}
