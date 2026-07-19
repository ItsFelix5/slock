// biome-ignore-all lint/performance/useTopLevelRegex: The expression is local to content parsing.
// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { LinkPreview, SavedItem } from "../../types";
import { callSlack, fileProxyUrl } from "../relay";

let emojiMapPromise: Promise<Record<string, string>> | null = null;

export function fetchAllEmoji(): Promise<Record<string, string>> {
  if (!emojiMapPromise) {
    emojiMapPromise = fetch("/emoji")
      .then((res) => res.text())
      .then((text) => {
        const names = text ? text.split("\n") : [];
        const resolved: Record<string, string> = {};
        for (const name of names) {
          resolved[name] = `/emoji-image?name=${encodeURIComponent(name)}`;
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
      desc: c.desc || "",
      icon: c.icons?.image_32 || null,
      name: c.name.replace(/^\//, ""),
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

export async function saveCanvas(fileId: string, markdown: string): Promise<void> {
  const changes = JSON.stringify([
    { document_content: { markdown, type: "markdown" }, operation: "replace" },
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

// Modern (non-deprecated) Slack upload flow: reserve an upload URL, then send
// the raw bytes to it, then tell Slack to attach the finished upload to a
// channel. The middle step can't be a direct browser POST to Slack's
// presigned URL — Slack doesn't grant our own origin CORS access to
// files.slack.com — so it goes through our own same-origin relay instead,
// which forwards it server-side where CORS doesn't apply.
export async function uploadFile(
  channelId: string,
  file: File,
  threadTs?: string,
  comment?: string,
): Promise<void> {
  const reserve = await callSlack("files.getUploadURLExternal", {
    filename: file.name,
    length: String(file.size),
  });
  if (!reserve.ok) throw new Error(reserve.error ?? "files.getUploadURLExternal failed");

  const uploadUrl = `/file-upload?url=${encodeURIComponent(reserve.upload_url)}&filename=${encodeURIComponent(file.name)}`;
  const putRes = await fetch(uploadUrl, { body: file, method: "POST" });
  if (!putRes.ok) throw new Error("file upload failed");

  const completeParams: Record<string, string> = {
    channel_id: channelId,
    files: JSON.stringify([{ id: reserve.file_id, title: file.name }]),
  };
  if (threadTs) completeParams.thread_ts = threadTs;
  if (comment) completeParams.initial_comment = comment;
  const complete = await callSlack("files.completeUploadExternal", completeParams);
  if (!complete.ok) throw new Error(complete.error ?? "files.completeUploadExternal failed");
}

// Client-side stand-in for Slack's own link unfurl, which only ever runs
// server-side after a message is posted — this lets the composer show a
// preview of a pasted/typed link before send, the way Slack's real composer
// does. Best-effort: any fetch/parse failure just means no preview, not an error.
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const res = await fetch(`/unfurl?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!(data.title || data.description || data.imageUrl)) return null;
    return {
      description: data.description,
      imageUrl: data.imageUrl,
      siteName: data.siteName,
      title: data.title,
      url,
    };
  } catch {
    return null;
  }
}
