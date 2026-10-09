import { type CanvasDocument, type CanvasMeta, readCanvas, readCanvasVersion } from "@slock/canvas";
import type {
  CanvasCommentThread,
  CanvasEdit,
  CanvasVersion,
  RawFile,
  RawMessage,
} from "@slock/types";
import { apiGet, apiPost, resolveMediaUrl } from "@slock/types";
import type { CanvasDocModel } from "../canvas/canvasDelta";
import { CanvasEditError } from "../canvas/canvasSync";

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
