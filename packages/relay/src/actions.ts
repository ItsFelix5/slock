import { callBot, uploadBotFiles } from "./slack";
import type { Identity } from "./token";

type Content = { text?: string; blocks?: unknown };

export type Action =
  | ({
      action: "post";
      threadTs?: string;
      replyBroadcast?: boolean;
      unfurl?: string[];
      files?: File[];
    } & Content)
  | ({
      action: "edit";
      ts: string;
      replyBroadcast?: boolean;
      fileIds?: string[];
      files?: File[];
    } & Content)
  | { action: "delete"; ts: string };

export type Outcome = { ok: true; ts?: string } | { error: string; ok: false };

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

const fail = (error: string): Outcome => ({ error, ok: false });

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

function withContent(params: Record<string, string>, { blocks }: Content) {
  if (blocks) params.blocks = JSON.stringify(blocks);
  return params;
}

function discard(team: string, ids: string[]) {
  return Promise.all(ids.map((file) => callBot(team, "files.delete", { file })));
}

async function upload(team: string, files: File[] | undefined) {
  return files?.length ? await uploadBotFiles(team, files) : { ids: [], ok: true as const };
}

async function post(
  team: string,
  channel: string,
  userId: string,
  member: Member,
  action: Extract<Action, { action: "post" }>,
): Promise<Outcome> {
  if (!(await isChannelManager(team, channel, userId))) return fail("not_a_channel_manager");
  const uploaded = await upload(team, action.files);
  if (!uploaded.ok) return fail(uploaded.error);
  const text = action.text ?? "";
  const params = withContent({ channel, text, username: member.name }, action);
  if (member.iconUrl) params.icon_url = member.iconUrl;
  if (action.threadTs) params.thread_ts = action.threadTs;
  if (action.threadTs && action.replyBroadcast) params.reply_broadcast = "true";
  if (action.unfurl && !action.unfurl.length) {
    params.unfurl_links = "false";
    params.unfurl_media = "false";
  }
  const posted = await callBot<{ ts: string }>(team, "chat.postMessage", params);
  if (!posted.ok) {
    await discard(team, uploaded.ids);
    return fail(posted.error);
  }
  if (!uploaded.ids.length) return { ok: true, ts: posted.ts };

  const attached = await callBot(
    team,
    "chat.update",
    withContent({ channel, file_ids: uploaded.ids.join(","), text, ts: posted.ts }, action),
  );
  if (attached.ok) return { ok: true, ts: posted.ts };
  await callBot(team, "chat.delete", { channel, ts: posted.ts });
  await discard(team, uploaded.ids);
  return fail(attached.error);
}

async function edit(
  team: string,
  channel: string,
  member: Member,
  action: Extract<Action, { action: "edit" }>,
): Promise<Outcome> {
  const message = await ownedMessage(team, channel, action.ts, member);
  if (!message) return fail("cant_update_message");
  const current = message.files?.map((file) => file.id) ?? [];
  if (action.fileIds?.some((id) => !current.includes(id))) return fail("invalid_file_ids");
  const uploaded = await upload(team, action.files);
  if (!uploaded.ok) return fail(uploaded.error);

  const hasText = action.text !== undefined;
  const params = withContent(
    { channel, text: action.text ?? message.text ?? "", ts: action.ts },
    hasText ? action : { blocks: message.blocks },
  );
  if (action.replyBroadcast) params.reply_broadcast = "true";
  const files = [...(action.fileIds ?? current), ...uploaded.ids];
  if (files.length !== current.length || files.some((id, i) => id !== current[i])) {
    params.file_ids = files.join(",");
  }
  const done = await callBot(team, "chat.update", params);
  if (!done.ok) {
    await discard(team, uploaded.ids);
    return fail(done.error);
  }
  await discard(
    team,
    current.filter((id) => !files.includes(id)),
  );
  return { ok: true, ts: action.ts };
}

async function remove(team: string, channel: string, member: Member, ts: string): Promise<Outcome> {
  const message = await ownedMessage(team, channel, ts, member);
  if (!message) return fail("cant_update_message");
  const done = await callBot(team, "chat.delete", { channel, ts });
  if (!done.ok) return fail(done.error);
  await discard(team, message.files?.map((file) => file.id) ?? []);
  return { ok: true, ts };
}

export async function perform(
  { team, user }: Identity,
  channel: string,
  action: Action,
): Promise<Outcome> {
  const found = await callBot<{ user: SlackUser }>(team, "users.info", { user });
  if (!found.ok) return fail(found.error);
  const profile = found.user;
  const member = {
    iconUrl: profile.profile?.image_192,
    name:
      profile.profile?.display_name ||
      profile.profile?.real_name ||
      profile.real_name ||
      profile.name ||
      "",
  };
  if (action.action === "post") return post(team, channel, user, member, action);
  if (action.action === "edit") return edit(team, channel, member, action);
  return remove(team, channel, member, action.ts);
}
