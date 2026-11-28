import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import { jsonResponse, slackErrorResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { FileInfoReply } from "@slock/plugins/slack/server/api/slackReplies";
import type { CanvasAccess, FileId } from "@slock/types";
import type { CanvasWire } from "./wire";

export function canvasAccess(file: { access?: string; is_locked?: boolean }): CanvasAccess {
  if (file.access === "write" || file.access === "owner")
    return file.is_locked ? "comment" : "edit";
  return file.access === "comment" ? "comment" : "view";
}

type ThreadLookup = { response: Response } | { access: CanvasAccess; threadId: string };

// Loading the hinted thread beside files.info saves a round trip when the client already knows it.
export async function openCanvas(
  wire: CanvasWire,
  fileId: FileId,
  threadHint: string | null,
  creds: Credentials,
) {
  const [lookup, hinted] = await Promise.all([
    lookupThread(fileId, creds),
    threadHint ? wire.fetchRaw(threadHint, creds) : undefined,
  ]);
  if ("response" in lookup) return lookup;
  const usable = lookup.threadId === threadHint ? hinted : undefined;
  return { ...lookup, raw: usable ?? (await wire.fetchRaw(lookup.threadId, creds)) };
}

export async function lookupThread(fileId: FileId, creds: Credentials): Promise<ThreadLookup> {
  const data = await callSlack<FileInfoReply>("files.info", { file: fileId }, creds);
  if (!data.ok) return { response: slackErrorResponse(data, "files.info") };
  const threadId = data.file.quip_thread_id;
  if (!threadId) {
    return { response: jsonResponse({ error: "canvas has no quip_thread_id" }, 502) };
  }
  return { access: canvasAccess(data.file), threadId };
}

export function notConfigured(): Response {
  return slackErrorResponse({ error: "not_configured" }, "files.info");
}
