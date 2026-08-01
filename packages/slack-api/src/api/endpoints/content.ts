// biome-ignore-all lint/performance/useTopLevelRegex: The expression is local to content parsing.
// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { LinkPreview, SavedItem } from "../../contentTypes";
import { callSlack, resolveMediaUrl } from "../server";

let emojiMapPromise: Promise<Record<string, string>> | null = null;

export function fetchAllEmoji(): Promise<Record<string, string>> {
  if (!emojiMapPromise) {
    emojiMapPromise = fetch("/api/emoji")
      .then((res) => {
        if (!res.ok) throw new Error(`Emoji list failed (${res.status})`);
        return res.text();
      })
      .then((text) => {
        const names = text ? text.split("\n") : [];
        const resolved: Record<string, string> = {};
        for (const name of names) {
          resolved[name] = `/api/emoji/${encodeURIComponent(name)}`;
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

interface CanvasFileInfo {
  title: string | null;
  url: string | null;
}

const canvasFileInfoRequests = new Map<string, Promise<CanvasFileInfo>>();

// Titles and backing URLs come from the same files.info payload. Keep that
// lookup shared so asynchronously naming an unlabeled tab does not add another
// request when the user immediately opens it.
function resolveCanvasFileInfo(fileId: string): Promise<CanvasFileInfo> {
  const existing = canvasFileInfoRequests.get(fileId);
  if (existing) return existing;
  const request = callSlack("files.info", { file: fileId })
    .then((info) => {
      if (!info.ok) throw new Error(info.error ?? "files.info failed");
      const downloadUrl = info.file?.url_private_download ?? info.file?.url_private;
      return {
        title: info.file?.title?.trim() || info.file?.name?.trim() || null,
        url: downloadUrl ? resolveMediaUrl(downloadUrl) : null,
      };
    })
    .catch((error) => {
      canvasFileInfoRequests.delete(fileId);
      throw error;
    });
  canvasFileInfoRequests.set(fileId, request);
  return request;
}

async function resolveCanvasFileUrl(fileId: string): Promise<string | null> {
  return (await resolveCanvasFileInfo(fileId)).url;
}

export async function fetchCanvasTitle(fileId: string): Promise<string | null> {
  try {
    return (await resolveCanvasFileInfo(fileId)).title;
  } catch {
    return null;
  }
}

// Reading a canvas's actual document content back out isn't something we can
// fully verify without live testing against a real canvas. Slack file URLs in
// API responses are already signed application resource URLs.
export async function fetchCanvas(fileId: string): Promise<string | null> {
  const url = await resolveCanvasFileUrl(fileId);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Canvas download failed (${res.status})`);
  return res.text();
}

// A direct, navigable link to the canvas's backing file, exposed so the UI can offer "open as a file"
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

// Modern Slack upload flow. The application server reserves the upload and
// returns a scoped capability; the browser never receives or chooses an
// upstream URL.
export async function uploadFiles(
  channelId: string,
  files: File[],
  threadTs?: string,
  comment?: string,
): Promise<void> {
  if (files.length === 0) return;
  const uploaded: { id: string; title: string }[] = [];
  for (const file of files) {
    const reserve = await fetch("/api/files/reserve", {
      body: JSON.stringify({ filename: file.name, length: String(file.size) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const reservation = await reserve.json();
    if (!(reserve.ok && reservation.ok)) {
      throw new Error(reservation.error ?? "File reservation failed");
    }

    const uploadUrl = `/api/files/upload/${reservation.upload_token}?filename=${encodeURIComponent(file.name)}`;
    const putRes = await fetch(uploadUrl, { body: file, method: "POST" });
    if (!putRes.ok) throw new Error(`Failed to upload ${file.name}.`);
    uploaded.push({ id: reservation.file_id, title: file.name });
  }

  const completeParams: Record<string, string> = {
    channel_id: channelId,
    files: JSON.stringify(uploaded),
  };
  if (threadTs) completeParams.thread_ts = threadTs;
  if (comment) completeParams.initial_comment = comment;
  const completeRes = await fetch("/api/files/complete", {
    body: JSON.stringify(completeParams),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const complete = await completeRes.json();
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

// Slack adds unfurls after send. The application server deliberately does not
// retrieve caller-selected URLs, so there is no pre-send preview request.
export function fetchLinkPreview(_url: string): Promise<LinkPreview | null> {
  return Promise.resolve(null);
}
