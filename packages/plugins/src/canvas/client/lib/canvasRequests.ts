import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import { defineQuery } from "@slock/plugins/query/client/api";
import { fetchPermalinkMessage } from "@slock/plugins/slack/client/api";
import { parseTs, replyError } from "@slock/slack";
import { apiGet, apiPost, mapReaction } from "@slock/slack/client";
import type {
  CanvasAccess,
  CanvasCard,
  CanvasCommentThread,
  CanvasEdit,
  CanvasVersion,
  ChannelId,
  FileId,
  Message,
  RawFile,
  RawMessage,
  Ts,
} from "@slock/types";
import { type CanvasMeta, readCanvas, readCanvasVersion } from "../../protocol/api";
import type { CanvasDocModel } from "./canvasDelta";
import { CanvasEditError } from "./canvasSync";

const env = service("env");

const MISSING_FILE_MS = 30_000;

const canvasFile = defineQuery<FileId, RawFile | null>({
  load: async (fileId, { signal }) => {
    const info = await apiGet<{ file: RawFile | null }>(
      `/api/canvases/${fileId}/file-info`,
      signal,
    );
    if (!info.ok) throw replyError(info, "files.info failed");
    return info.file;
  },
  maxAgeMs: (file) => (file ? Number.POSITIVE_INFINITY : MISSING_FILE_MS),
  name: "canvasFile",
  retry: { retries: 0 },
});

function visible(file: RawFile | null): RawFile {
  if (!file) throw new Error("not_visible");
  return file;
}

export const findCanvasFile = (fileId: FileId) => canvasFile.ensure(fileId);

export async function resolveCanvasFile(fileId: FileId): Promise<RawFile> {
  return visible(await canvasFile.ensure(fileId));
}

export async function refreshCanvasFile(fileId: FileId): Promise<RawFile> {
  return visible(await canvasFile.refresh(fileId));
}

export function createCanvasFileQuery(fileId: () => FileId | undefined) {
  return canvasFile.state(fileId);
}

const cardMessage = defineQuery<{ channelId: ChannelId; ts: Ts }, Message | null>({
  load: async ({ channelId, ts }) => (await fetchPermalinkMessage(channelId, ts, ts)) ?? null,
  name: "canvasCardMessage",
});

export function createCanvasCardQuery(card: () => CanvasCard) {
  return cardMessage.state(() => ({ channelId: card().channelId, ts: card().ts }));
}

export function canvasFileTitle(file: RawFile | null | undefined): string | undefined {
  return file?.title?.trim() || file?.name?.trim() || undefined;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface LoadedCanvas {
  access: CanvasAccess;
  doc: CanvasDocModel | null;
  fetchedAt: number;
}

const threadIds = new Map<FileId, string>();

function threadQuery(fileId: FileId): string {
  const threadId = threadIds.get(fileId);
  return threadId ? `?${new URLSearchParams({ thread: threadId })}` : "";
}

export async function fetchCanvasRaw(
  fileId: FileId,
  signal?: AbortSignal,
): Promise<{ access: CanvasAccess; bytes: Uint8Array }> {
  const data = await apiGet<{ access: CanvasAccess; raw: string }>(
    `/api/canvases/${fileId}/raw${threadQuery(fileId)}`,
    signal,
  );
  if (!data.ok) throw replyError(data, "Canvas content failed");
  return { access: data.access, bytes: base64ToBytes(data.raw) };
}

export class CanvasReadError extends Error {}

export async function fetchCanvas(fileId: FileId, signal?: AbortSignal): Promise<LoadedCanvas> {
  const fetchedAt = env.now();
  const { access, bytes } = await fetchCanvasRaw(fileId, signal);
  try {
    const document = readCanvas(bytes);
    if (!document) throw new Error("Canvas has no metadata");
    threadIds.set(fileId, document.meta.threadId);
    return { access, doc: document, fetchedAt };
  } catch (error) {
    throw new CanvasReadError(errorMessage(error), {
      cause: error,
    });
  }
}

export async function fetchCanvasVersions(
  fileId: FileId,
  signal?: AbortSignal,
): Promise<CanvasVersion[]> {
  const data = await apiGet<{ versions: CanvasVersion[] }>(
    `/api/canvases/${fileId}/versions`,
    signal,
  );
  if (!data.ok) throw replyError(data, "Canvas history failed");
  return data.versions;
}

export async function fetchCanvasVersion(
  fileId: FileId,
  version: CanvasVersion,
  meta: CanvasMeta,
  signal: AbortSignal,
): Promise<CanvasDocModel | null> {
  const query = new URLSearchParams({
    document: meta.documentId,
    sequence: String(version.sequence),
  });
  const data = await apiGet<{ raw: string }>(
    `/api/canvases/${fileId}/versions/${version.versionId}?${query}`,
    signal,
  );
  if (!data.ok) throw replyError(data, "Canvas version failed");
  return readCanvasVersion(base64ToBytes(data.raw), meta);
}

export async function restoreCanvasVersion(fileId: FileId, version: CanvasVersion): Promise<void> {
  const data = await apiPost(`/api/canvases/${fileId}/versions/${version.versionId}/restore`, {
    sequence: version.sequence,
  });
  if (!data.ok) throw replyError(data, "Couldn't restore this version");
}

export async function fetchCanvasComments(
  fileId: FileId,
  signal?: AbortSignal,
): Promise<CanvasCommentThread[]> {
  const data = await apiGet<{ threads: RawMessage[] }>(`/api/canvases/${fileId}/comments`, signal);
  if (!data.ok) throw replyError(data, "Canvas comments failed");
  return data.threads.flatMap((message) => {
    const threadId = message.document_comment?.thread_id;
    if (!threadId) return [];
    return [
      {
        archived: !!message.document_comment?.is_archived,
        quote: message.text ?? "",
        reactions: (message.reactions ?? []).map(mapReaction),
        replyCount: message.reply_count ?? 0,
        threadId,
        ts: parseTs(message.ts),
      },
    ];
  });
}

export async function openCanvasComment(fileId: FileId, annotationId: string): Promise<Ts> {
  const data = await apiPost<{ ts: string }>(
    `/api/canvases/${fileId}/comments/open${threadQuery(fileId)}`,
    { annotationId },
  );
  if (!data.ok) throw replyError(data, "Couldn't open the comment");
  return parseTs(data.ts);
}

export async function syncCanvasComment(fileId: FileId, ts: Ts): Promise<void> {
  const data = await apiPost(`/api/canvases/${fileId}/comments/sync`, { ts });
  if (!data.ok) throw replyError(data, "Couldn't sync the comment");
}

export async function resolveCanvasComment(
  fileId: FileId,
  ts: Ts,
  resolved: boolean,
): Promise<void> {
  const data = await apiPost(`/api/canvases/${fileId}/comments/resolve`, { resolved, ts });
  if (!data.ok) throw replyError(data, "Couldn't update the comment");
}

export async function postCanvasEdit(fileId: FileId, edit: CanvasEdit): Promise<void> {
  const data = await apiPost(`/api/canvases/${fileId}/edit${threadQuery(fileId)}`, edit);
  if (!data.ok) throw new CanvasEditError(data.error ?? "edit_failed");
}
