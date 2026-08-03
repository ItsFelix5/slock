// biome-ignore-all lint/style/useNamingConvention: Mirrors Slack's wire field names.
import { trimBot, trimMessage, trimUser } from "./slackEntities.ts";
import { trimChannel, trimReadResponse } from "./slackReadResponse.ts";

function trimMutation(method: string, data: any): any {
  if (method === "conversations.rename") {
    return { channel: { name: data.channel?.name }, ok: true };
  }
  if (method === "canvases.create" || method === "conversations.canvases.create") {
    return { canvas_id: data.canvas_id, ok: true };
  }
  if (method === "conversations.join" || method === "conversations.create") {
    return { channel: trimChannel(data.channel), ok: true };
  }
  if (method === "files.getUploadURLExternal") {
    return { file_id: data.file_id, ok: true, upload_url: data.upload_url };
  }
  if (method === "users.channelSections.create") {
    const section = data.channel_section ?? data;
    return {
      channel_section: {
        channel_section_id: section.channel_section_id,
        id: section.id,
        name: section.name,
      },
      ok: true,
    };
  }
  if (method === "drafts.create") {
    return { draft: { id: data.draft?.id }, id: data.id, ok: true };
  }
  return { ok: true };
}

const OK_ONLY_METHODS = new Set([
  "apps.actions.v2.execute",
  "blocks.actions",
  "canvases.access.set",
  "canvases.edit",
  "channels.prefs.set",
  "chat.command",
  "conversations.invite",
  "conversations.kick",
  "conversations.leave",
  "conversations.permissions.accountTypes.set",
  "conversations.setPurpose",
  "conversations.setRetention",
  "conversations.setTopic",
  "drafts.delete",
  "dnd.endSnooze",
  "dnd.setSnooze",
  "files.completeUploadExternal",
  "subscriptions.thread.add",
  "subscriptions.thread.mark",
  "subscriptions.thread.remove",
  "usergroups.update",
  "usergroups.users.update",
  "users.channelSections.channels.bulkUpdate",
  "users.channelSections.delete",
  "users.channelSections.set",
  "users.channelSections.update",
  "users.prefs.set",
  "users.prefs.setNotifications",
  "users.profile.set",
  "users.setPresence",
]);

export function trimSlackResponse(method: string, data: any): any {
  if (!data?.ok) return data;
  const readResponse = trimReadResponse(method, data);
  if (readResponse) return readResponse;
  if (method === "search.autocomplete") {
    return { ok: true, suggestions: { text: data.suggestions?.text } };
  }
  if (method === "search.modules.people") {
    return {
      items: Array.isArray(data.items) ? data.items.map(trimUser) : data.items,
      ok: true,
      pagination: { total_count: data.pagination?.total_count },
    };
  }
  if (method === "search.modules.channels") {
    return {
      items: Array.isArray(data.items) ? data.items.map(trimChannel) : data.items,
      ok: true,
    };
  }
  if (method === "conversations.info") return { channel: trimChannel(data.channel), ok: true };
  if (method === "conversations.view") {
    return {
      channel: trimChannel(data.channel),
      history: {
        has_more: data.history?.has_more,
        messages: Array.isArray(data.history?.messages)
          ? data.history.messages.map(trimMessage)
          : data.history?.messages,
      },
      ok: true,
      users: Array.isArray(data.users) ? data.users.map(trimUser) : data.users,
    };
  }
  if (method === "channels.prefs.get") {
    const prefs = data.prefs ?? data;
    return {
      ok: true,
      prefs:
        prefs && typeof prefs === "object"
          ? {
              can_thread: prefs.can_thread,
              enable_at_channel: prefs.enable_at_channel,
              enable_at_here: prefs.enable_at_here,
              who_can_post: prefs.who_can_post,
            }
          : prefs,
    };
  }
  if (method === "conversations.open") {
    return { channel: { id: data.channel?.id }, ok: true };
  }
  if (method === "bots.info") return { bot: trimBot(data.bot), ok: true };
  if (method === "team.profile.get") {
    return {
      ok: true,
      profile: {
        fields: Array.isArray(data.profile?.fields)
          ? data.profile.fields.map((field: any) => ({
              id: field?.id,
              is_hidden: field?.is_hidden,
              label: field?.label,
              ordering: field?.ordering,
            }))
          : data.profile?.fields,
      },
    };
  }
  if (method === "users.channelSections.list") {
    return {
      channel_sections: Array.isArray(data.channel_sections)
        ? data.channel_sections.map((section: any) => ({
            channel_ids: section?.channel_ids,
            channel_ids_page: section?.channel_ids_page
              ? { channel_ids: section.channel_ids_page.channel_ids }
              : undefined,
            channel_section_id: section?.channel_section_id,
            channels: section?.channels,
            id: section?.id,
            name: section?.name,
            sidebar: section?.sidebar,
            type: section?.type,
          }))
        : data.channel_sections,
      ok: true,
    };
  }
  if (method === "client.appCommands") {
    return {
      app_actions: Array.isArray(data.app_actions)
        ? data.app_actions.map((app: any) => ({
            actions: Array.isArray(app?.actions)
              ? app.actions.map((action: any) => ({
                  action_id: action?.action_id,
                  desc: action?.desc,
                  description: action?.description,
                  name: action?.name,
                  type: action?.type,
                }))
              : app?.actions,
            app_id: app?.app_id,
            app_name: app?.app_name,
            icons: app?.icons,
          }))
        : data.app_actions,
      ok: true,
    };
  }
  if (method === "apps.profile.get") {
    return { app_profile: { desc: data.app_profile?.desc }, ok: true };
  }
  if (method === "commands.list") {
    const commands = data.commands ?? {};
    return {
      commands: Object.fromEntries(
        Object.entries(commands).map(([key, command]: [string, any]) => [
          key,
          {
            desc: command?.desc,
            icons: { image_32: command?.icons?.image_32 },
            name: command?.name,
          },
        ]),
      ),
      ok: true,
    };
  }
  if (method === "saved.list") {
    const items = data.saved_items ?? data.items;
    const trimmed = Array.isArray(items)
      ? items.map((item: any) => ({
          channel: item?.channel,
          channel_id: item?.channel_id,
          item_id: item?.item_id,
          item_type: item?.item_type,
          message_ts: item?.message_ts,
          ts: item?.ts,
        }))
      : items;
    return data.saved_items ? { ok: true, saved_items: trimmed } : { items: trimmed, ok: true };
  }
  if (method === "files.info") {
    return {
      file: {
        name: data.file?.name,
        title: data.file?.title,
        url_private: data.file?.url_private,
        url_private_download: data.file?.url_private_download,
      },
      ok: true,
    };
  }
  if (method === "drafts.list") {
    return {
      drafts: Array.isArray(data.drafts)
        ? data.drafts.map((draft: any) => ({
            blocks: draft?.blocks,
            client_msg_id: draft?.client_msg_id,
            destinations: Array.isArray(draft?.destinations)
              ? draft.destinations.map((destination: any) => ({
                  channel_id: destination?.channel_id,
                  thread_ts: destination?.thread_ts,
                }))
              : draft?.destinations,
            id: draft?.id,
          }))
        : data.drafts,
      ok: true,
    };
  }
  if (method === "admin.roles.entity.listAssignments") {
    return {
      ok: true,
      role_assignments: Array.isArray(data.role_assignments)
        ? data.role_assignments.map((assignment: any) => ({ users: assignment?.users }))
        : data.role_assignments,
    };
  }
  if (method === "usergroups.users.list") return { ok: true, users: data.users };
  if (method === "dnd.info") {
    return {
      ok: true,
      snooze_enabled: data.snooze_enabled,
      snooze_endtime: data.snooze_endtime,
    };
  }
  if (
    method === "conversations.rename" ||
    method === "conversations.join" ||
    method === "conversations.create" ||
    method === "files.getUploadURLExternal" ||
    method === "users.channelSections.create" ||
    method === "drafts.create" ||
    OK_ONLY_METHODS.has(method)
  )
    return trimMutation(method, data);
  return data;
}
