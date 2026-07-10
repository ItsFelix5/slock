import type { SavedItem } from "../types";
import { callSlack, fileProxyUrl } from "./relay";

let emojiMapPromise: Promise<Record<string, string>> | null = null;

export function fetchAllEmoji(): Promise<Record<string, string>> {
  if (!emojiMapPromise) {
    emojiMapPromise = callSlack("emoji.list").then((data) => {
      if (!data.ok) return {};
      const raw: Record<string, string> = data.emoji ?? {};
      const resolved: Record<string, string> = {};
      for (const name of Object.keys(raw)) {
        let value = raw[name];
        let hops = 0;
        while (typeof value === "string" && value.startsWith("alias:") && hops < 5) {
          value = raw[value.slice("alias:".length)];
          hops++;
        }
        if (typeof value === "string" && value.startsWith("http")) resolved[name] = value;
      }
      return resolved;
    });
  }
  return emojiMapPromise;
}

export async function fetchSlashCommands(): Promise<
  { name: string; desc: string; icon: string | null }[]
> {
  const data = await callSlack("commands.list");
  if (!data.ok) return [];
  const commandsObj = data.commands ?? {};
  return Object.values<any>(commandsObj)
    .filter((c) => c?.name)
    .map((c) => ({
      name: c.name.replace(/^\//, ""),
      desc: c.desc || "",
      icon: c.icons?.image_32 || null,
    }));
}

export async function fetchSaved(): Promise<SavedItem[]> {
  const data = await callSlack("saved.list", { limit: "40" });
  if (!data.ok) return [];
  // saved.list returns `saved_items`, each shaped like { item_id (the channel),
  // item_type: 'message', ts, ... } — item_id/ts sit at the top level, not nested.
  const items: any[] = data.saved_items ?? data.items ?? [];
  return items
    .filter((it) => !it.item_type || it.item_type === "message")
    .map((it) => ({
      channelId: it.item_id ?? it.channel_id ?? it.channel,
      ts: it.ts ?? it.message_ts,
    }))
    .filter((it): it is SavedItem => !!it.channelId && !!it.ts);
}

// Reading a canvas's actual document content back out isn't something we can
// fully verify without live testing against a real canvas — best-effort: fetch
// the backing file's content through the cookie-authenticated file proxy.
export async function fetchCanvas(fileId: string): Promise<string | null> {
  const info = await callSlack("files.info", { file: fileId });
  if (!info.ok) return null;
  const downloadUrl = info.file?.url_private_download ?? info.file?.url_private;
  if (!downloadUrl) return null;
  try {
    const res = await fetch(fileProxyUrl(downloadUrl));
    return await res.text();
  } catch {
    return null;
  }
}

export async function createChannelCanvas(channelId: string): Promise<string | null> {
  const data = await callSlack("conversations.canvases.create", { channel_id: channelId });
  if (!data.ok) return null;
  return data.canvas_id ?? null;
}

export async function saveCanvas(fileId: string, markdown: string): Promise<void> {
  const changes = JSON.stringify([
    { operation: "replace", document_content: { type: "markdown", markdown } },
  ]);
  const data = await callSlack("canvases.edit", { canvas_id: fileId, changes });
  if (!data.ok) throw new Error(data.error ?? "canvases.edit failed");
}

export async function runSlashCommand(
  channelId: string,
  command: string,
  text: string,
): Promise<string | null> {
  // Best-effort: there's no documented public method for dispatching a slash
  // command from a client — this mirrors the internal call the real webapp
  // makes, which we can't fully verify without live testing.
  const data = await callSlack("chat.command", { channel: channelId, command, text });
  if (!data.ok) return data.error ?? "Command not supported by this client.";
  return null;
}

// Modern (non-deprecated) Slack upload flow: reserve an upload URL, PUT the raw
// bytes to it directly from the browser (the same presigned-URL flow the real
// web client uses — no cookie required for this step), then tell Slack to
// attach the finished upload to a channel.
export async function uploadFile(
  channelId: string,
  file: File,
  threadTs?: string,
  comment?: string,
): Promise<void> {
  const buffer = await file.arrayBuffer();
  const reserve = await callSlack("files.getUploadURLExternal", {
    filename: file.name,
    length: String(buffer.byteLength),
  });
  if (!reserve.ok) throw new Error(reserve.error ?? "files.getUploadURLExternal failed");

  const uploadForm = new FormData();
  uploadForm.append("file", new Blob([buffer]), file.name);
  const putRes = await fetch(reserve.upload_url, { method: "POST", body: uploadForm });
  if (!putRes.ok) throw new Error("file upload failed");

  const completeParams: Record<string, string> = {
    files: JSON.stringify([{ id: reserve.file_id, title: file.name }]),
    channel_id: channelId,
  };
  if (threadTs) completeParams.thread_ts = threadTs;
  if (comment) completeParams.initial_comment = comment;
  const complete = await callSlack("files.completeUploadExternal", completeParams);
  if (!complete.ok) throw new Error(complete.error ?? "files.completeUploadExternal failed");
}
