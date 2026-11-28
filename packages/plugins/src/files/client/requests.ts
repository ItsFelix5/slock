import { ifPresent, mapFile, parseChannelId, parseTs, parseUserId, replyError } from "@slock/slack";
import { apiGet, apiPost, apiPut } from "@slock/slack/client";
import type {
  ApiReply,
  ChannelId,
  FileId,
  RawFile,
  RawFileShare,
  SlackFileDetail,
  SlackFileShare,
  UserId,
} from "@slock/types";

export async function fetchFileDetail(
  fileId: FileId,
  signal: AbortSignal,
): Promise<SlackFileDetail> {
  const data = await apiGet<{
    access: RawFileAccess | null;
    content?: string | null;
    contentTruncated?: boolean;
    editable?: boolean;
    file: RawFile;
    shares?: RawFileShare[];
    starred?: boolean;
    viewer_count?: number | null;
  }>(`/api/files/${fileId}/detail`, signal);
  if (!data.ok) throw replyError(data, "files.info failed");
  return {
    access: data.access && mapFileAccess(data.access),
    content: data.content ?? null,
    contentTruncated: !!data.contentTruncated,
    editable: data.editable === true,
    file: mapFile(data.file),
    shares: (data.shares ?? []).map(mapFileShare),
    starred: !!data.starred,
    viewerCount: data.viewer_count ?? null,
  };
}

export async function renameFile(fileId: FileId, title: string): Promise<void> {
  const data = await apiPost(`/api/files/${fileId}/rename`, { title });
  if (!data.ok) throw replyError(data, "Couldn't rename the file");
}

export type FileAccessTarget = { channelId: ChannelId } | { userId: UserId };

type AccessGrant = FileAccessTarget & { level: string; orgId: string };

export function addFileAccess(fileId: FileId, grant: AccessGrant) {
  return expectAccessChange(apiPost(`/api/files/${fileId}/access`, grant));
}

export function updateFileAccess(fileId: FileId, grant: AccessGrant) {
  return expectAccessChange(apiPut(`/api/files/${fileId}/access`, grant));
}

export function removeFileAccess(fileId: FileId, orgId: string, target: FileAccessTarget) {
  return expectAccessChange(apiPost(`/api/files/${fileId}/access/remove`, { ...target, orgId }));
}

export function setFileOrgAccess(fileId: FileId, orgId: string, level: string) {
  return expectAccessChange(apiPost(`/api/files/${fileId}/org-access`, { level, orgId }));
}

async function expectAccessChange(reply: Promise<ApiReply<object>>) {
  const data = await reply;
  if (!data.ok) throw replyError(data, "Couldn't update access");
}

function mapFileAccess(raw: RawFileAccess): NonNullable<SlackFileDetail["access"]> {
  return {
    canManage: raw.can_manage,
    channels: raw.channels.map((entry) => ({
      access: entry.access,
      channelId: parseChannelId(entry.channel_id),
      name: entry.name,
      private: entry.private,
    })),
    hiddenChannelCount: raw.hidden_channels,
    orgId: raw.org_id,
    orgLevel: raw.org_level,
    orgName: raw.org_name,
    users: raw.users.map((entry) => ({
      access: entry.access,
      editHeldBy: entry.edit_held_by,
      userId: parseUserId(entry.user_id),
    })),
  };
}

export function mapFileShare(raw: RawFileShare): SlackFileShare {
  return {
    access: raw.access,
    channelId: parseChannelId(raw.channel_id),
    channelName: raw.channel_name ?? raw.channel_id,
    replyCount: raw.reply_count,
    sharedByUserId: ifPresent(parseUserId, raw.share_user_id),
    threadTs: ifPresent(parseTs, raw.thread_ts),
    ts: parseTs(raw.ts),
  };
}

type RawFileAccess = {
  can_manage: boolean;
  channels: { access: string; channel_id: string; name?: string; private?: boolean }[];
  hidden_channels: number;
  org_id: string;
  org_level: string;
  org_name?: string;
  users: { access: string; edit_held_by?: "channel" | "org"; user_id: string }[];
};
