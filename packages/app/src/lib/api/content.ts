import type {
  CanvasBlock,
  FileUploadInput,
  LinkPreview,
  RawFile,
  SavedItem,
  SlackFileDetail,
} from "@slock/types";
import { apiGet, apiPost, mapFile, mapFileShare, resolveMediaUrl } from "@slock/types";
import { toCanvasBlocks } from "../canvas/canvasBlocks";
import { parseLoadDataResponse } from "../canvas/canvasParse";

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

const canvasFileRequests = new Map<string, Promise<RawFile>>();

function resolveCanvasFile(fileId: string): Promise<RawFile> {
  const existing = canvasFileRequests.get(fileId);
  if (existing) return existing;
  const request = apiGet(`/api/canvases/${fileId}/file-info`)
    .then((info) => {
      if (!info.ok) throw new Error(info.error ?? "files.info failed");
      const file: RawFile = info.file;
      return file;
    })
    .catch((error) => {
      canvasFileRequests.delete(fileId);
      throw error;
    });
  canvasFileRequests.set(fileId, request);
  return request;
}

export async function fetchCanvasTitle(fileId: string): Promise<string | null> {
  try {
    const file = await resolveCanvasFile(fileId);
    return file.title?.trim() || file.name?.trim() || null;
  } catch {
    return null;
  }
}

export async function fetchCanvasPermalink(fileId: string): Promise<string | null> {
  try {
    return (await resolveCanvasFile(fileId)).permalink ?? null;
  } catch {
    return null;
  }
}

export async function fetchCanvasFileUrl(fileId: string): Promise<string | null> {
  try {
    const file = await resolveCanvasFile(fileId);
    return file.url_private_download ? resolveMediaUrl(file.url_private_download) : null;
  } catch {
    return null;
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function fetchCanvas(fileId: string): Promise<CanvasBlock[]> {
  const data = await apiGet(`/api/canvases/${fileId}/raw`);
  if (!data.ok) throw new Error(data.error ?? "Canvas content failed");
  const { blocks, embedsById } = parseLoadDataResponse(base64ToBytes(data.raw));
  const fileIds = new Set<string>();
  for (const embed of embedsById.values()) if (embed.type === "file") fileIds.add(embed.fileId);
  for (const block of blocks)
    if (block.type === "image") for (const id of block.fileIds) fileIds.add(id);
  const entries = await Promise.all(
    [...fileIds].map(async (id) => {
      try {
        return [id, await resolveCanvasFile(id)] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  const filesById = new Map(
    entries.filter((entry): entry is [string, RawFile] => entry[1] !== null),
  );
  return toCanvasBlocks(blocks, embedsById, filesById);
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
