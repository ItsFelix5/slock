// biome-ignore-all lint/style/useNamingConvention: Mirrors Slack's wire field names.
import { trimReadResponse } from "./slackReadResponse.ts";

// Shared with routes/sections.ts's GET /api/sections — bootstrap.ts still
// calls this method through the auto-trimming callSlack path until Phase 18
// moves it onto explicit fetchSlack + trim calls like everything else.
export function trimChannelSections(data: any): any {
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

function trimMutation(method: string, data: any): any {
  if (method === "files.getUploadURLExternal") {
    return { file_id: data.file_id, ok: true, upload_url: data.upload_url };
  }
  return { ok: true };
}

const OK_ONLY_METHODS = new Set([
  "apps.actions.v2.execute",
  "blocks.actions",
  "chat.command",
  "dnd.endSnooze",
  "dnd.setSnooze",
  "files.completeUploadExternal",
  "usergroups.update",
  "usergroups.users.update",
  "users.prefs.set",
]);

export function trimSlackResponse(method: string, data: any): any {
  if (!data?.ok) return data;
  const readResponse = trimReadResponse(method, data);
  if (readResponse) return readResponse;
  if (method === "search.autocomplete") {
    return { ok: true, suggestions: { text: data.suggestions?.text } };
  }
  if (method === "users.channelSections.list") return trimChannelSections(data);
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
  if (method === "usergroups.users.list") return { ok: true, users: data.users };
  if (method === "dnd.info") {
    return {
      ok: true,
      snooze_enabled: data.snooze_enabled,
      snooze_endtime: data.snooze_endtime,
    };
  }
  if (method === "files.getUploadURLExternal" || OK_ONLY_METHODS.has(method))
    return trimMutation(method, data);
  return data;
}
