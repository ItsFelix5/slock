import { type CanvasDocument, type CanvasMeta, readCanvas, readCanvasVersion } from "@slock/canvas";
import type {
  CanvasCommentThread,
  CanvasEdit,
  CanvasVersion,
  FileUploadInput,
  LinkPreview,
  RawFile,
  RawFileShare,
  RawMessage,
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

async function withFiles(document: CanvasDocument): Promise<CanvasDocModel> {
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
  return { ...document, files };
}

export async function fetchCanvas(fileId: string): Promise<LoadedCanvas> {
  const data = await apiGet<{ editable?: boolean; raw: string }>(`/api/canvases/${fileId}/raw`);
  if (!data.ok) throw new Error(data.error ?? "Canvas content failed");
  const document = readCanvas(base64ToBytes(data.raw));
  if (!document) return { doc: null, editable: false };
  return { doc: await withFiles(document), editable: data.editable !== false };
}

export async function fetchCanvasVersions(fileId: string): Promise<CanvasVersion[]> {
  const data = await apiGet<{ versions: CanvasVersion[] }>(`/api/canvases/${fileId}/versions`);
  if (!data.ok) throw new Error(data.error ?? "Canvas history failed");
  return data.versions;
}

export async function fetchCanvasVersion(
  fileId: string,
  version: CanvasVersion,
  meta: CanvasMeta,
): Promise<CanvasDocModel | null> {
  const query = new URLSearchParams({
    document: meta.documentId,
    sequence: String(version.sequence),
  });
  const data = await apiGet<{ raw: string }>(
    `/api/canvases/${fileId}/versions/${version.versionId}?${query}`,
  );
  if (!data.ok) throw new Error(data.error ?? "Canvas version failed");
  const document = readCanvasVersion(base64ToBytes(data.raw), meta);
  return document ? withFiles(document) : null;
}

export async function restoreCanvasVersion(fileId: string, version: CanvasVersion): Promise<void> {
  const data = await apiPost(`/api/canvases/${fileId}/versions/${version.versionId}/restore`, {
    sequence: version.sequence,
  });
  if (!data.ok) throw new Error(data.error ?? "Couldn't restore this version");
}

export interface CanvasComments {
  channelId: string;
  threads: CanvasCommentThread[];
}

export async function fetchCanvasComments(fileId: string): Promise<CanvasComments> {
  const data = await apiGet<{ channelId?: string; threads: RawMessage[] }>(
    `/api/canvases/${fileId}/comments`,
  );
  if (!data.ok) throw new Error(data.error ?? "Canvas comments failed");
  const threads = data.threads.flatMap((message) => {
    const threadId = message.document_comment?.thread_id;
    if (!threadId) return [];
    return [
      {
        archived: !!message.document_comment?.is_archived,
        authorIds: message.reply_users ?? [],
        latestReply: message.latest_reply ?? null,
        quote: message.text ?? "",
        reactions: message.reactions ?? [],
        replyCount: message.reply_count ?? 0,
        threadId,
        ts: message.ts,
      },
    ];
  });
  return { channelId: data.channelId ?? "", threads };
}

export async function openCanvasComment(
  fileId: string,
  annotationId: string,
): Promise<{ channelId: string; ts: string }> {
  const data = await apiPost<{ channelId: string; ts: string }>(
    `/api/canvases/${fileId}/comments/open`,
    { annotationId },
  );
  if (!data.ok) throw new Error(data.error ?? "Couldn't open the comment");
  return { channelId: data.channelId, ts: data.ts };
}

export async function postCanvasEdit(fileId: string, edit: CanvasEdit): Promise<void> {
  const data = await apiPost(`/api/canvases/${fileId}/edit`, edit);
  if (!data.ok) throw new CanvasEditError(data.error ?? "edit_failed");
}

export async function fetchFileDetail(fileId: string): Promise<SlackFileDetail> {
  const data = await apiGet<{
    access: { org_level: string; users: { access: string; user_id: string }[] };
    content?: string | null;
    contentTruncated?: boolean;
    editable?: boolean;
    file: RawFile;
    owner?: string | null;
    shares?: RawFileShare[];
    starred?: boolean;
    viewer_count?: number | null;
  }>(`/api/files/${fileId}/detail`);
  if (!data.ok) throw new Error(data.error ?? "files.info failed");
  return {
    access: {
      orgLevel: data.access.org_level,
      users: data.access.users.map((entry) => ({ access: entry.access, userId: entry.user_id })),
    },
    content: data.content ?? null,
    contentTruncated: !!data.contentTruncated,
    editable: data.editable !== false,
    file: mapFile(data.file),
    ownerId: data.owner ?? null,
    shares: (data.shares ?? []).map(mapFileShare),
    starred: !!data.starred,
    viewerCount: data.viewer_count ?? null,
  };
}

export async function renameFile(fileId: string, title: string): Promise<void> {
  const data = await apiPost(`/api/files/${fileId}/rename`, { title });
  if (!data.ok) throw new Error(data.error ?? "Couldn't rename the file");
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
