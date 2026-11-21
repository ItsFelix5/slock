import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import { jsonResponse, slackErrorResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { FileInfoReply } from "@slock/plugins/slack/server/api/slackReplies";
import type { FileId } from "@slock/types";

export function canEditCanvas(file: { editable?: unknown }): boolean {
  return file.editable === true;
}

export type ThreadLookup = { response: Response } | { editable: boolean; threadId: string };

export async function lookupThread(fileId: FileId, creds: Credentials): Promise<ThreadLookup> {
  const data = await callSlack<FileInfoReply>("files.info", { file: fileId }, creds);
  if (!data.ok) return { response: slackErrorResponse(data, "files.info") };
  const threadId = data.file.quip_thread_id;
  if (!threadId) {
    return { response: jsonResponse({ error: "canvas has no quip_thread_id" }, 502) };
  }
  return { editable: canEditCanvas(data.file), threadId };
}

export function notConfigured(): Response {
  return slackErrorResponse({ error: "not_configured" }, "files.info");
}
