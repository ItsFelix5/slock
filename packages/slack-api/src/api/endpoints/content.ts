// biome-ignore-all lint/performance/useTopLevelRegex: The expression is local to content parsing.
// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { LinkPreview, SavedItem } from "../../contentTypes";
import { callSlack, fileProxyUrl } from "../relay";

let emojiMapPromise: Promise<Record<string, string>> | null = null;

export function fetchAllEmoji(): Promise<Record<string, string>> {
  if (!emojiMapPromise) {
    emojiMapPromise = fetch("/emoji")
      .then((res) => {
        if (!res.ok) throw new Error(`Emoji list failed (${res.status})`);
        return res.text();
      })
      .then((text) => {
        const names = text ? text.split("\n") : [];
        const resolved: Record<string, string> = {};
        for (const name of names) {
          resolved[name] = `/emoji-image?name=${encodeURIComponent(name)}`;
        }
        return resolved;
      })
      .catch((error) => {
        emojiMapPromise = null;
        throw error;
      });
  }
  return emojiMapPromise;
}

export async function fetchSlashCommands(): Promise<
  { name: string; desc: string; icon: string | null }[]
> {
  const data = await callSlack("commands.list");
  if (!data.ok) throw new Error(data.error ?? "commands.list failed");
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
  if (!data.ok) throw new Error(data.error ?? "saved.list failed");
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

// Shared by fetchCanvas (reads the content) and fetchCanvasFileUrl (just
// needs the link) — both start from the same files.info lookup for the
// canvas's backing file.
async function resolveCanvasFileUrl(fileId: string): Promise<string | null> {
  const info = await callSlack("files.info", { file: fileId });
  if (!info.ok) throw new Error(info.error ?? "files.info failed");
  const downloadUrl = info.file?.url_private_download ?? info.file?.url_private;
  return downloadUrl ? fileProxyUrl(downloadUrl) : null;
}

// Reading a canvas's actual document content back out isn't something we can
// fully verify without live testing against a real canvas — best-effort: fetch
// the backing file's content through the cookie-authenticated file proxy.
export async function fetchCanvas(fileId: string): Promise<string | null> {
  const url = await resolveCanvasFileUrl(fileId);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Canvas download failed (${res.status})`);
  return res.text();
}

// A direct, navigable link to the canvas's backing file — same cookie-proxied
// URL fetchCanvas reads from, exposed so the UI can offer "open as a file"
// (new tab, copy link, download) instead of only the in-app rich editor.
export async function fetchCanvasFileUrl(fileId: string): Promise<string | null> {
  try {
    return await resolveCanvasFileUrl(fileId);
  } catch {
    // The external-file action is optional; content loading reports its own
    // failure and should not lose the whole panel over a missing shortcut.
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
export async function uploadFiles(
  channelId: string,
  files: File[],
  threadTs?: string,
  comment?: string,
): Promise<void> {
  if (files.length === 0) return;
  const uploaded: { id: string; title: string }[] = [];
  for (const file of files) {
    const reserve = await callSlack("files.getUploadURLExternal", {
      filename: file.name,
      length: String(file.size),
    });
    if (!reserve.ok) throw new Error(reserve.error ?? "files.getUploadURLExternal failed");

    const uploadUrl = `/file-upload?url=${encodeURIComponent(reserve.upload_url)}&filename=${encodeURIComponent(file.name)}`;
    const putRes = await fetch(uploadUrl, { body: file, method: "POST" });
    if (!putRes.ok) throw new Error(`Failed to upload ${file.name}.`);
    uploaded.push({ id: reserve.file_id, title: file.name });
  }

  const completeParams: Record<string, string> = {
    channel_id: channelId,
    files: JSON.stringify(uploaded),
  };
  if (threadTs) completeParams.thread_ts = threadTs;
  if (comment) completeParams.initial_comment = comment;
  const complete = await callSlack("files.completeUploadExternal", completeParams);
  if (!complete.ok) throw new Error(complete.error ?? "files.completeUploadExternal failed");
}

export function uploadFile(
  channelId: string,
  file: File,
  threadTs?: string,
  comment?: string,
): Promise<void> {
  return uploadFiles(channelId, [file], threadTs, comment);
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
