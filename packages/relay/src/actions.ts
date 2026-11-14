import { callBot } from "./slack";

type Content = { text: string; blocks?: unknown };

export type Action =
  | ({ action: "post"; threadTs?: string; unfurl?: string[] } & Content)
  | ({ action: "edit"; ts: string } & Content)
  | { action: "delete"; ts: string };

type SlackUser = {
  id: string;
  name?: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string; image_192?: string };
};

type Member = { name: string; iconUrl?: string };

async function isChannelManager(team: string, channel: string, userId: string) {
  const assignments = await callBot<{ role_assignments?: { users?: string[] }[] }>(
    team,
    "admin.roles.entity.listAssignments",
    { entity_id: channel },
  );
  return assignments.ok && !!assignments.role_assignments?.some((a) => a.users?.includes(userId));
}

async function ownsMessage(team: string, channel: string, ts: string, member: Member) {
  const replies = await callBot<{
    messages?: { ts: string; bot_id?: string; username?: string }[];
  }>(team, "conversations.replies", { channel, limit: "1", ts });
  const message = replies.ok ? replies.messages?.find((m) => m.ts === ts) : undefined;
  return !!message?.bot_id && message.username === member.name;
}

function withContent(params: Record<string, string>, { blocks }: Content) {
  if (blocks) params.blocks = JSON.stringify(blocks);
  return params;
}

export async function perform(team: string, channel: string, userId: string, action: Action) {
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
    const params = withContent({ channel, text: action.text, username: member.name }, action);
    if (member.iconUrl) params.icon_url = member.iconUrl;
    if (action.threadTs) params.thread_ts = action.threadTs;
    if (action.unfurl && !action.unfurl.length) {
      params.unfurl_links = "false";
      params.unfurl_media = "false";
    }
    const posted = await callBot(team, "chat.postMessage", params);
    return posted.ok ? undefined : posted.error;
  }

  if (!(await ownsMessage(team, channel, action.ts, member))) return "cant_update_message";
  const done =
    action.action === "edit"
      ? await callBot(
          team,
          "chat.update",
          withContent({ channel, text: action.text, ts: action.ts }, action),
        )
      : await callBot(team, "chat.delete", { channel, ts: action.ts });
  return done.ok ? undefined : done.error;
}
