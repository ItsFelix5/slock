// biome-ignore-all lint/style/useNamingConvention: Mirrors Slack's wire field names.
import { trimReadResponse } from "./slackReadResponse.ts";

// Shared by routes/sections.ts's GET /api/sections and bootstrap.ts's
// conditional sections fan-out — both call users.channelSections.list
// directly via fetchSlack and trim its response the same way.
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

const OK_ONLY_METHODS = new Set(["files.completeUploadExternal"]);

export function trimSlackResponse(method: string, data: any): any {
  if (!data?.ok) return data;
  const readResponse = trimReadResponse(method, data);
  if (readResponse) return readResponse;
  if (method === "files.getUploadURLExternal" || OK_ONLY_METHODS.has(method))
    return trimMutation(method, data);
  return data;
}
