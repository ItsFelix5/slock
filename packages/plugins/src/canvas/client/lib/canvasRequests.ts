import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import {
  apiGet,
  apiPost,
  mapReaction,
  parseChannelId,
  parseTs,
  parseUserId,
} from "@slock/slack";
import type {
  CanvasCommentThread,
  CanvasEdit,
  CanvasVersion,
  ChannelId,
  FileId,
  RawFile,
  RawMessage,
  Ts,
} from "@slock/types";
import { createQuery, queryOptions } from "@tanstack/solid-query";
import { defineKey } from "../../../query/client/api";
import { type CanvasMeta, readCanvas, readCanvasVersion } from "../../protocol/api";
import type { CanvasDocModel } from "./canvasDelta";
import { CanvasEditError } from "./canvasSync";

const canvasFileKey = defineKey<[string]>("canvasFile");

const query = service("query");

function canvasFileOptions(fileId: FileId) {
  return queryOptions({
    queryFn: async () => {
      const info = await apiGet<{ file: RawFile | null }>(`/api/canvases/${fileId}/file-info`);
      if (!info.ok) throw new Error(info.error ?? "files.info failed");
      return info.file;
    },
    queryKey: canvasFileKey(fileId),
    staleTime: Infinity,
  });
}

export async function resolveCanvasFile(fileId: FileId): Promise<RawFile> {
  const file = await query.client.query(canvasFileOptions(fileId));
  if (!file) throw new Error("not_visible");
  return file;
}

export function createCanvasFileQuery(fileId: () => string) {
  return createQuery(
    () => ({ ...canvasFileOptions(fileId()), retry: false }),
    () => query.client,
  );
}

export function canvasFileTitle(file: RawFile | null | undefined): string | undefined {
  return file?.title?.trim() || file?.name?.trim() || undefined;
}

export async function fetchCanvasTitleOrVisibility(
  fileId: FileId,
): Promise<{ notVisible: boolean; title: string | null }> {
  try {
    const file = await resolveCanvasFile(fileId);
    return { notVisible: false, title: canvasFileTitle(file) ?? null };
  } catch (err) {
    return { notVisible: err instanceof Error && err.message === "not_visible", title: null };
  }
}

export async function fetchCanvasTitle(fileId: FileId): Promise<string | null> {
  return (await fetchCanvasTitleOrVisibility(fileId)).title;
}

export async function fetchCanvasPermalink(fileId: FileId): Promise<string | null> {
  try {
    return (await resolveCanvasFile(fileId)).permalink ?? null;
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

export async function fetchCanvasRaw(
  fileId: FileId,
): Promise<{ bytes: Uint8Array; editable: boolean }> {
  const data = await apiGet<{ editable?: boolean; raw: string }>(`/api/canvases/${fileId}/raw`);
  if (!data.ok) throw new Error(data.error ?? "Canvas content failed");
  return { bytes: base64ToBytes(data.raw), editable: data.editable === true };
}

export class CanvasReadError extends Error {}

export async function fetchCanvas(fileId: FileId): Promise<LoadedCanvas> {
  const { bytes, editable } = await fetchCanvasRaw(fileId);
  try {
    const document = readCanvas(bytes);
    if (!document) throw new Error("Canvas has no metadata");
    return { doc: document, editable };
  } catch (error) {
    throw new CanvasReadError(errorMessage(error), {
      cause: error,
    });
  }
}

export async function fetchCanvasVersions(fileId: FileId): Promise<CanvasVersion[]> {
  const data = await apiGet<{ versions: CanvasVersion[] }>(`/api/canvases/${fileId}/versions`);
  if (!data.ok) throw new Error(data.error ?? "Canvas history failed");
  return data.versions;
}

export async function fetchCanvasVersion(
  fileId: FileId,
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
  return readCanvasVersion(base64ToBytes(data.raw), meta);
}

export async function restoreCanvasVersion(fileId: FileId, version: CanvasVersion): Promise<void> {
  const data = await apiPost(`/api/canvases/${fileId}/versions/${version.versionId}/restore`, {
    sequence: version.sequence,
  });
  if (!data.ok) throw new Error(data.error ?? "Couldn't restore this version");
}

export interface CanvasComments {
  channelId: ChannelId | null;
  threads: CanvasCommentThread[];
}

export async function fetchCanvasComments(fileId: FileId): Promise<CanvasComments> {
  const data = await apiGet<{ channelId?: string; threads: RawMessage[] }>(
    `/api/canvases/${fileId}/comments`,
  );
  if (!data.ok) throw new Error(data.error ?? "Canvas comments failed");
  const threads = data.threads.flatMap((message) => {
    const threadId = message.document_comment?.thread_id;
    if (!(threadId && (message.reply_count || message.reactions?.length))) return [];
    return [
      {
        archived: !!message.document_comment?.is_archived,
        authorIds: (message.reply_users ?? []).map(parseUserId),
        latestReply: message.latest_reply ? parseTs(message.latest_reply) : null,
        quote: message.text ?? "",
        reactions: (message.reactions ?? []).map(mapReaction),
        replyCount: message.reply_count ?? 0,
        threadId,
        ts: parseTs(message.ts),
      },
    ];
  });
  return { channelId: data.channelId ? parseChannelId(data.channelId) : null, threads };
}

export async function openCanvasComment(
  fileId: FileId,
  annotationId: string,
): Promise<{ channelId: ChannelId; ts: Ts }> {
  const data = await apiPost<{ channelId: string; ts: string }>(
    `/api/canvases/${fileId}/comments/open`,
    { annotationId },
  );
  if (!data.ok) throw new Error(data.error ?? "Couldn't open the comment");
  return { channelId: parseChannelId(data.channelId), ts: parseTs(data.ts) };
}

export async function postCanvasEdit(fileId: FileId, edit: CanvasEdit): Promise<void> {
  const data = await apiPost(`/api/canvases/${fileId}/edit`, edit);
  if (!data.ok) throw new CanvasEditError(data.error ?? "edit_failed");
}
