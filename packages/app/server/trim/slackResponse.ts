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

const OK_ONLY_METHODS = new Set(["chat.command", "files.completeUploadExternal"]);

export function trimSlackResponse(method: string, data: any): any {
  if (!data?.ok) return data;
  const readResponse = trimReadResponse(method, data);
  if (readResponse) return readResponse;
  if (method === "users.channelSections.list") return trimChannelSections(data);
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
