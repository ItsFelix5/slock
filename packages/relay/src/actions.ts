import { callBot, uploadBotFiles } from "./slack";

type Content = { text: string; blocks?: unknown };

export type Action =
  | ({
      action: "post";
      threadTs?: string;
      replyBroadcast?: boolean;
      unfurl?: string[];
      uploadId?: string;
    } & Content)
  | ({
      action: "edit";
      ts: string;
      replyBroadcast?: boolean;
      fileIds?: string[];
    } & Partial<Content>)
  | { action: "delete"; ts: string };

type SlackUser = {
  id: string;
  name?: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string; image_192?: string };
};

type Member = { name: string; iconUrl?: string };

type SentMessage = {
  ts: string;
  bot_id?: string;
  username?: string;
  text?: string;
  blocks?: unknown;
  files?: { id: string }[];
};

async function isChannelManager(team: string, channel: string, userId: string) {
  const assignments = await callBot<{ role_assignments?: { users?: string[] }[] }>(
    team,
    "admin.roles.entity.listAssignments",
    { entity_id: channel },
  );
  return assignments.ok && !!assignments.role_assignments?.some((a) => a.users?.includes(userId));
}

async function ownedMessage(team: string, channel: string, ts: string, member: Member) {
  const replies = await callBot<{ messages?: SentMessage[] }>(team, "conversations.replies", {
    channel,
    limit: "1",
    ts,
  });
  const message = replies.ok ? replies.messages?.find((m) => m.ts === ts) : undefined;
  return message?.bot_id && message.username === member.name ? message : undefined;
}

function withContent(params: Record<string, string>, { blocks }: { blocks?: unknown }) {
  if (blocks) params.blocks = JSON.stringify(blocks);
  return params;
}

async function post(
  team: string,
  channel: string,
  member: Member,
  action: Extract<Action, { action: "post" }>,
  files: File[],
) {
  const uploaded = await uploadBotFiles(team, files);
  if (!uploaded.ok) return uploaded.error;
  const params = withContent({ channel, text: action.text, username: member.name }, action);
  if (member.iconUrl) params.icon_url = member.iconUrl;
  if (action.threadTs) params.thread_ts = action.threadTs;
  if (action.threadTs && action.replyBroadcast) params.reply_broadcast = "true";
  if (action.unfurl && !action.unfurl.length) {
    params.unfurl_links = "false";
    params.unfurl_media = "false";
  }
  const posted = await callBot<{ ts: string }>(team, "chat.postMessage", params);
  if (!posted.ok) return posted.error;
  if (!uploaded.ids.length) return;

  const attached = await callBot(
    team,
    "chat.update",
    withContent(
      { channel, file_ids: uploaded.ids.join(","), text: action.text, ts: posted.ts },
      action,
    ),
  );
  if (attached.ok) return;
  await callBot(team, "chat.delete", { channel, ts: posted.ts });
  return attached.error;
}

async function edit(
  team: string,
  channel: string,
  message: SentMessage,
  action: Extract<Action, { action: "edit" }>,
) {
  const current = message.files?.map((file) => file.id) ?? [];
  const files = action.fileIds ?? current;
  if (files.some((id) => !current.includes(id))) return "invalid_file_ids";
  const params = withContent(
    { channel, text: action.text ?? message.text ?? "", ts: action.ts },
    action.text === undefined ? { blocks: message.blocks } : action,
  );
  if (action.replyBroadcast) params.reply_broadcast = "true";
  if (files.length !== current.length) params.file_ids = files.join(",");
  const done = await callBot(team, "chat.update", params);
  return done.ok ? undefined : done.error;
}

async function remove(team: string, channel: string, message: SentMessage) {
  const done = await callBot(team, "chat.delete", { channel, ts: message.ts });
  if (!done.ok) return done.error;
  await Promise.all(
    message.files?.map((file) => callBot(team, "files.delete", { file: file.id })) ?? [],
  );
}

export async function perform(
  team: string,
  channel: string,
  userId: string,
  action: Action,
  files: File[] = [],
) {
  const found = await callBot<{ user: SlackUser }>(team, "users.info", { user: userId });
  if (!found.ok) return found.error;
  const { user } = found;
  const member = {
    iconUrl: user.profile?.image_192,
    name:
      user.profile?.display_name || user.profile?.real_name || user.real_name || user.name || "",
  };

  if (action.action === "post") {
    if (!(await isChannelManager(team, channel, userId))) return "not_a_channel_manager";
    return post(team, channel, member, action, files);
  }

  const message = await ownedMessage(team, channel, action.ts, member);
  if (!message) return "cant_update_message";
  return action.action === "edit"
    ? edit(team, channel, message, action)
    : remove(team, channel, message);
}
