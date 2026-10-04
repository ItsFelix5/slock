import { readCanvas } from "@slock/canvas";
import type {
  CanvasEdit,
  FileUploadInput,
  LinkPreview,
  RawFile,
  RawFileShare,
  SavedItem,
  SlackFile,
  SlackFileDetail,
} from "@slock/types";
import { apiGet, apiPost, mapFile, mapFileShare, resolveMediaUrl } from "@slock/types";
import type { CanvasDocModel } from "../canvas/canvasDelta";
import { CanvasEditError } from "../canvas/canvasSync";

export async function fetchSaved(): Promise<SavedItem[]> {
  const data = await apiGet<{ items?: SavedItem[] }>("/api/saved");
  if (!data.ok) throw new Error(data.error ?? "saved.list failed");
  return data.items ?? [];
}

const canvasFileRequests = new Map<string, Promise<RawFile>>();

export function resolveCanvasFile(fileId: string): Promise<RawFile> {
  const existing = canvasFileRequests.get(fileId);
  if (existing) return existing;
  const request = apiGet<{ file: RawFile }>(`/api/canvases/${fileId}/file-info`)
    .then((info) => {
      if (!info.ok) throw new Error(info.error ?? "files.info failed");
      return info.file;
    })
    .catch((error) => {
      canvasFileRequests.delete(fileId);
      throw error;
    });
  canvasFileRequests.set(fileId, request);
  return request;
}

export async function fetchCanvasTitleOrVisibility(
  fileId: string,
): Promise<{ notVisible: boolean; title: string | null }> {
  try {
    const file = await resolveCanvasFile(fileId);
    return { notVisible: false, title: file.title?.trim() || file.name?.trim() || null };
  } catch (err) {
    return { notVisible: err instanceof Error && err.message === "not_visible", title: null };
  }
}

export async function fetchCanvasTitle(fileId: string): Promise<string | null> {
  return (await fetchCanvasTitleOrVisibility(fileId)).title;
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

export interface LoadedCanvas {
  doc: CanvasDocModel | null;
  editable: boolean;
}

export async function fetchCanvas(fileId: string): Promise<LoadedCanvas> {
  const data = await apiGet<{ editable?: boolean; raw: string }>(`/api/canvases/${fileId}/raw`);
  if (!data.ok) throw new Error(data.error ?? "Canvas content failed");
  const document = readCanvas(base64ToBytes(data.raw));
  if (!document) return { doc: null, editable: false };
  const entries = await Promise.all(
    document.fileIds.map(async (id) => {
      try {
        return [id, await resolveCanvasFile(id)] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  const files = new Map(entries.filter((entry): entry is [string, RawFile] => entry[1] !== null));
  return { doc: { ...document, files }, editable: data.editable !== false };
}

export async function postCanvasEdit(fileId: string, edit: CanvasEdit): Promise<void> {
  const data = await apiPost(`/api/canvases/${fileId}/edit`, edit);
  if (!data.ok) throw new CanvasEditError(data.error ?? "edit_failed");
}

export async function fetchFileDetail(fileId: string): Promise<SlackFileDetail> {
  const data = await apiGet<{
    content?: string | null;
    contentTruncated?: boolean;
    file: RawFile;
    shares?: RawFileShare[];
  }>(`/api/files/${fileId}/detail`);
  if (!data.ok) throw new Error(data.error ?? "files.info failed");
  return {
    content: data.content ?? null,
    contentTruncated: !!data.contentTruncated,
    file: mapFile(data.file),
    shares: (data.shares ?? []).map(mapFileShare),
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

function uploadFileWithProgress(url: string, file: File, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Failed to upload ${file.name}.`));
    };
    xhr.onerror = () => reject(new Error(`Failed to upload ${file.name}.`));
    xhr.send(file);
  });
}

async function reserveAndUploadFiles(
  files: FileUploadInput[],
  onProgress?: (fileIndex: number, fraction: number) => void,
): Promise<{ id: string; title: string }[]> {
  const uploaded: { id: string; title: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const { file, title } = files[i];
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
    await uploadFileWithProgress(uploadUrl, file, (fraction) => onProgress?.(i, fraction));
    uploaded.push({ id: reservation.file_id, title: title?.trim() || file.name });
  }
  return uploaded;
}

async function completeUpload(
  uploaded: { id: string; title: string }[],
  extra?: Record<string, string>,
): Promise<SlackFile[]> {
  const completeRes = await fetch("/api/files/complete", {
    body: JSON.stringify({ files: JSON.stringify(uploaded), ...extra }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const complete = await completeRes.json();
  if (!completeRes.ok) throw new Error(complete.error ?? "files.completeUploadExternal failed");
  const files: RawFile[] = complete.files ?? [];
  return files.map(mapFile);
}

export async function uploadFiles(
  channelId: string,
  files: FileUploadInput[],
  threadTs?: string,
  comment?: string,
  onProgress?: (fileIndex: number, fraction: number) => void,
): Promise<void> {
  if (files.length === 0) return;
  const uploaded = await reserveAndUploadFiles(files, onProgress);
  const extra: Record<string, string> = { channel_id: channelId };
  if (threadTs) extra.thread_ts = threadTs;
  if (comment) extra.initial_comment = comment;
  await completeUpload(uploaded, extra);
}

export async function uploadFilesForEdit(
  files: FileUploadInput[],
  onProgress?: (fileIndex: number, fraction: number) => void,
): Promise<SlackFile[]> {
  if (files.length === 0) return [];
  const uploaded = await reserveAndUploadFiles(files, onProgress);
  return completeUpload(uploaded);
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
