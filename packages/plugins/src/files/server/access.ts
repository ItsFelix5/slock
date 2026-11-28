import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { mutate, route } from "@slock/plugins/slack/server/api/router";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { FileInfoReply } from "@slock/plugins/slack/server/api/slackReplies";
import type { RawFileShare } from "@slock/types";

type File = FileInfoReply["file"];

function canManage({ access, filetype, is_locked, is_restricted_sharing_enabled }: File) {
  if (filetype !== "quip" || is_locked) return false;
  return access === "owner" || (access === "write" && !is_restricted_sharing_enabled);
}

function accessBase(file: File) {
  return {
    can_manage: canManage(file),
    org_id: file.user_team ?? "",
    org_level: file.org_or_workspace_access ?? "none",
  };
}

function sharedAccess(file: File, shares: RawFileShare[]) {
  return {
    ...accessBase(file),
    channels: [...new Map(shares.map((share) => [share.channel_id, share])).values()].map(
      ({ access, channel_id, channel_name }) => ({
        access: access ?? "read",
        channel_id,
        name: channel_name,
      }),
    ),
    hidden_channels: 0,
    users: (file.dm_mpdm_users_with_file_access ?? []).flatMap(({ access, user_id }) =>
      user_id ? [{ access: user_id === file.user ? "owner" : (access ?? "read"), user_id }] : [],
    ),
  };
}

function editHolder(canUpdate = "can_update") {
  if (canUpdate === "can_update") return;
  return canUpdate === "cannot_downgrade_channel_edit" ? "channel" : "org";
}

async function canvasAccess(file: File, creds: Credentials | null) {
  const list = <T extends object>(type: "channels" | "users") =>
    callSlack<T>("files.getMetadata", { file_id: file.id, limit: "1000", type }, creds);
  const [channels, users, org] = await Promise.all([
    list<ChannelListReply>("channels"),
    list<UserListReply>("users"),
    callSlack<TeamReply>("team.info", { team: file.user_team ?? "" }, creds),
  ]);
  if (!(channels.ok && users.ok)) return null;
  return {
    ...accessBase(file),
    channels: channels.entities.map(({ access, channel_id, is_private }) => ({
      access,
      channel_id,
      private: is_private,
    })),
    hidden_channels: channels.private_channel_count,
    org_name: org.ok ? org.team.name : undefined,
    users: users.entities.map(({ access, can_update, user_id }) => ({
      access,
      edit_held_by: editHolder(can_update),
      user_id,
    })),
  };
}

export function fileAccess(file: File, shares: RawFileShare[], creds: Credentials | null) {
  return file.filetype === "quip" ? canvasAccess(file, creds) : sharedAccess(file, shares);
}

type AccessBody = { channelId?: string; level?: string; orgId?: string; userId?: string };

export const accessRoutes: Route[] = [
  route("POST", "files/:id/access", async (ctx) => {
    const { channelId, level, orgId, userId } = await ctx.body.json<AccessBody>();
    if (!(level && orgId && (channelId || userId))) return errorResponse("invalid_access", 400);
    let channel = channelId ?? "";
    if (userId) {
      const dm = await callSlack<DmReply>(
        "conversations.open",
        { quiet: "true", return_im: "true", users: userId },
        ctx.creds,
      );
      if (!dm.ok) return slackErrorResponse(dm, "conversations.open");
      channel = dm.channel.id;
    }
    return mutate(
      "files.share",
      {
        channel,
        client_context_team_id: orgId,
        files: ctx.params.id,
        from_share_modal: "true",
        permissions: JSON.stringify([{ file_id: ctx.params.id, grant: level }]),
        resharing_aware: "true",
        silent_share: "true",
        skip_dlp_user_warning: "false",
      },
      ctx,
    );
  }),

  route("PUT", "files/:id/access", async (ctx) => {
    const { channelId, level, orgId, userId } = await ctx.body.json<AccessBody>();
    if (!(level && orgId && (channelId || userId))) return errorResponse("invalid_access", 400);
    const target: Record<string, string> = userId
      ? { user_id_access_level_map: JSON.stringify([{ access_level: level, user_id: userId }]) }
      : {
          channel_id_access_level_map: JSON.stringify([
            { access_level: level, channel_id: channelId },
          ]),
        };
    const data = await callSlack<PermissionReply>(
      "files.updatePermission",
      { ...target, file_id: ctx.params.id, team_id: orgId },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "files.updatePermission");
    if (data.failed_to_update_channel_ids?.length || data.failed_to_update_user_ids?.length) {
      return errorResponse("update_permission_failed", 502);
    }
    return jsonResponse({ ok: true });
  }),

  route("POST", "files/:id/access/remove", async (ctx) => {
    const { channelId, orgId, userId } = await ctx.body.json<AccessBody>();
    if (!(orgId && (channelId || userId))) return errorResponse("invalid_access", 400);
    const target: Record<string, string> = userId
      ? { user_id: userId }
      : { channel_id: channelId ?? "" };
    return mutate(
      "files.revokePermission",
      { ...target, file_id: ctx.params.id, team_id: orgId },
      ctx,
    );
  }),

  route("POST", "files/:id/org-access", async (ctx) => {
    const { level, orgId } = await ctx.body.json<AccessBody>();
    if (!(level && orgId)) return errorResponse("invalid_access", 400);
    const entity = {
      entity_id: orgId,
      entity_type: orgId.startsWith("E") ? "org" : "workspace",
      file_id: ctx.params.id,
    };
    return level === "none"
      ? mutate("files.disableCrossWorkspaceLinkSharing", entity, ctx)
      : mutate("files.enableCrossWorkspaceLinkSharing", { ...entity, access_level: level }, ctx);
  }),
];

type ChannelListReply = {
  entities: { access: string; channel_id: string; is_private: boolean }[];
  private_channel_count: number;
};

type UserListReply = { entities: { access: string; can_update?: string; user_id: string }[] };

type TeamReply = { team: { name: string } };

type DmReply = { channel: { id: string } };

type PermissionReply = {
  failed_to_update_channel_ids?: string[];
  failed_to_update_user_ids?: string[];
};
