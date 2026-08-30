import type { FileUploadInput, LinkPreview, SavedItem, SlackFileDetail } from "@slock/types";
import { apiGet, apiPost, mapFile, mapFileShare, resolveMediaUrl } from "@slock/types";

export async function fetchSlashCommands(): Promise<
  { name: string; desc: string; icon: string | null }[]
> {
  const data = await apiGet("/api/commands");
  if (!data.ok) throw new Error(data.error ?? "fetching commands failed");
  return data.commands ?? [];
}

export async function fetchSaved(): Promise<SavedItem[]> {
  const data = await apiGet("/api/saved");
  if (!data.ok) throw new Error(data.error ?? "saved.list failed");
  return data.items ?? [];
}

interface CanvasFileInfo {
  title: string | null;
  url: string | null;
}

const canvasFileInfoRequests = new Map<string, Promise<CanvasFileInfo>>();

function resolveCanvasFileInfo(fileId: string): Promise<CanvasFileInfo> {
  const existing = canvasFileInfoRequests.get(fileId);
  if (existing) return existing;
  const request = apiGet(`/api/canvases/${fileId}/file-info`)
    .then((info) => {
      if (!info.ok) throw new Error(info.error ?? "files.info failed");
      return {
        title: info.title,
        url: info.url_private_download ? resolveMediaUrl(info.url_private_download) : null,
      };
    })
    .catch((error) => {
      canvasFileInfoRequests.delete(fileId);
      throw error;
    });
  canvasFileInfoRequests.set(fileId, request);
  return request;
}

export async function fetchCanvasTitle(fileId: string): Promise<string | null> {
  try {
    return (await resolveCanvasFileInfo(fileId)).title;
  } catch {
    return null;
  }
}

export async function fetchCanvas(fileId: string): Promise<string | null> {
  const { url } = await resolveCanvasFileInfo(fileId);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Canvas download failed (${res.status})`);
  return res.text();
}

export async function fetchCanvasFileUrl(fileId: string): Promise<string | null> {
  try {
    return (await resolveCanvasFileInfo(fileId)).url;
  } catch {
    return null;
  }
}

export async function fetchFileDetail(fileId: string): Promise<SlackFileDetail> {
  const data = await apiGet(`/api/files/${fileId}/detail`);
  if (!data.ok) throw new Error(data.error ?? "files.info failed");
  return {
    content: data.content ?? null,
    contentTruncated: !!data.contentTruncated,
    file: mapFile(data.file),
    shares: Array.isArray(data.shares) ? data.shares.map(mapFileShare) : [],
  };
}

export async function runSlashCommand(
  channelId: string,
  command: string,
  text: string,
): Promise<string | null> {
  const data = await apiPost("/api/commands/run", { channelId, command, text });
  if (!data.ok) return data.error ?? "Command not supported by this client.";
  return null;
}

export async function uploadFiles(
  channelId: string,
  files: FileUploadInput[],
  threadTs?: string,
  comment?: string,
): Promise<void> {
  if (files.length === 0) return;
  const uploaded: { id: string; title: string }[] = [];
  for (const { file, title } of files) {
    const reserve = await fetch("/api/files/reserve", {
      body: JSON.stringify({ filename: file.name, length: String(file.size) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const reservation = await reserve.json();
    if (!(reserve.ok && reservation.file_id && reservation.upload_token)) {
      throw new Error(reservation.error ?? "File reservation failed");
    }

    const uploadUrl = `/api/files/upload/${reservation.upload_token}?filename=${encodeURIComponent(file.name)}`;
    const putRes = await fetch(uploadUrl, { body: file, method: "POST" });
    if (!putRes.ok) throw new Error(`Failed to upload ${file.name}.`);
    uploaded.push({ id: reservation.file_id, title: title?.trim() || file.name });
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
  if (!completeRes.ok) throw new Error(complete.error ?? "files.completeUploadExternal failed");
}

export function uploadFile(
  channelId: string,
  file: File,
  threadTs?: string,
  comment?: string,
): Promise<void> {
  return uploadFiles(channelId, [{ file }], threadTs, comment);
}

export function fetchLinkPreview(_url: string): Promise<LinkPreview | null> {
  return Promise.resolve(null);
}
