import type { ChannelUpdates, GatewayEvent } from "@slock/types";
import type { RawDraft } from "../../slack/server/api/slackReplies";
import { trimDraft } from "../../slack/server/api/trim/slackDrafts";

type SyncPayload = {
  channel?: string | { id?: string };
  channels?: unknown[];
  draft?: RawDraft;
  draft_id?: string;
  file_id?: string;
  name?: string;
  subteam_id?: string;
  subtype?: string;
  type?: string;
  user?: string | { id?: string };
  updates?: {
    is_archived?: boolean;
    permissions?: unknown;
    topic?: { value?: string };
  };
  value?: string;
};

function channelId(channel: SyncPayload["channel"]): string | undefined {
  return typeof channel === "string" ? channel : channel?.id;
}

function updatedChannelIds(payload: SyncPayload): string[] {
  if (payload.channels)
    return payload.channels.filter((id): id is string => typeof id === "string");
  const id = channelId(payload.channel);
  return id ? [id] : [];
}

function trimUpdates(updates: SyncPayload["updates"]): ChannelUpdates {
  return {
    archived: updates?.is_archived,
    postingChanged: updates?.permissions ? true : undefined,
    topic: updates?.topic?.value,
  };
}

function userId(user: SyncPayload["user"]): string | undefined {
  return typeof user === "string" ? user : user?.id;
}

function draftEvent(
  draft: RawDraft | undefined,
  type: "draft_create" | "draft_update",
): GatewayEvent | null {
  const entry = draft?.id ? trimDraft(draft) : undefined;
  return entry ? { draft: entry, type } : null;
}

export function trimSyncEvent(payload: SyncPayload): GatewayEvent | null {
  switch (payload.type) {
    case "channel_changed":
    case "channel_history_changed":
    case "group_history_changed":
    case "im_history_changed":
    case "mpim_history_changed":
      return { channel: channelId(payload.channel), type: payload.type };
    case "channel_updated":
      return {
        channels: updatedChannelIds(payload),
        type: payload.type,
        updates: trimUpdates(payload.updates),
      };
    case "pref_change":
      return { name: payload.name, type: payload.type, value: payload.value };
    case "document_change":
      return { file_id: channelId(payload.channel), type: payload.type };
    case "document_update":
      return { file_id: payload.file_id, type: payload.type };
    case "draft_create":
    case "draft_update":
      return draftEvent(payload.draft, payload.type);
    case "draft_delete":
    case "draft_send":
      return { draft_id: payload.draft_id, type: payload.type };
    case "dnd_updated_user":
    case "dnd_invalidated":
      return { type: payload.type, user: userId(payload.user) };
    case "activity":
      return { subtype: payload.subtype, type: payload.type };
    case "subteam_self_added":
    case "subteam_self_removed":
      return { subteam_id: payload.subteam_id, type: payload.type };
    case "activity_mark_all_read_completed":
    case "activity_views_updated":
    case "apps_changed":
    case "apps_installed":
    case "apps_uninstalled":
    case "channel_section_deleted":
    case "channel_section_reset":
    case "channel_section_upserted":
    case "channel_sections_channels_removed":
    case "channel_sections_channels_upserted":
    case "saved_due":
    case "saved_updated":
      return { type: payload.type };
    default:
      return null;
  }
}
