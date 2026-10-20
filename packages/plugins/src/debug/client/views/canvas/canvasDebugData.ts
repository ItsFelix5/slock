import { service } from "@slock/core/solid";
import {
  type CanvasDocModel,
  fetchCanvasComments,
  fetchCanvasRaw,
  fetchCanvasVersions,
  resolveCanvasFile,
} from "../../../../canvas/client/api";
import { decodeLoadData, dumpRaw } from "../../../../canvas/protocol/api";

const usersStore = service("users");

const userName = (id: string) => usersStore.userById(id)?.name ?? id;

async function settle<T>(promise: Promise<T>): Promise<T | { error: string }> {
  try {
    return await promise;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function toHex(bytes: Uint8Array, limit: number): string {
  const head = Array.from(bytes.slice(0, limit), (b) => b.toString(16).padStart(2, "0"));
  return head.join(" ") + (bytes.length > limit ? ` ... (${bytes.length - limit} more)` : "");
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

export interface CanvasDebugTabs {
  Overview: unknown;
  Nodes: unknown;
  Records: unknown;
  Embeds: unknown;
  Threads: unknown;
  Versions: unknown;
  File: unknown;
  Raw: unknown;
}

export async function loadCanvasDebug(
  fileId: string,
  doc: CanvasDocModel | null,
): Promise<CanvasDebugTabs> {
  const [raw, file, comments, versions] = await Promise.all([
    settle(fetchCanvasRaw(fileId)),
    settle(resolveCanvasFile(fileId)),
    settle(fetchCanvasComments(fileId)),
    settle(fetchCanvasVersions(fileId)),
  ]);
  const decoded = "bytes" in raw ? decodeLoadData(raw.bytes) : null;
  const nodes = doc?.nodes ?? [];

  return {
    Embeds: {
      embeds: Object.fromEntries(doc?.embeds ?? []),
      files: Object.fromEntries(doc?.files ?? []),
    },
    File: file,
    Nodes: nodes,
    Overview: {
      editable: "editable" in raw ? raw.editable : raw,
      fileId,
      meta: doc?.meta ?? decoded?.meta ?? null,
      nodeKinds: countBy(nodes, (node) => node.kind),
      nodes: nodes.length,
      rawBytes: "bytes" in raw ? raw.bytes.length : raw,
      records: decoded?.records.length ?? 0,
      recordTypes: countBy(decoded?.records ?? [], (record) => `type ${record.type}`),
      threads: "threads" in comments ? comments.threads.length : comments,
      title: doc?.title ?? null,
      versions: Array.isArray(versions) ? versions.length : versions,
    },
    Raw:
      "bytes" in raw
        ? {
            base64: btoa(Array.from(raw.bytes, (b) => String.fromCharCode(b)).join("")),
            bytes: raw.bytes.length,
            hexHead: toHex(raw.bytes, 256),
          }
        : raw,
    Records: (decoded?.records ?? []).map(({ msg, ...record }) => ({
      ...record,
      fields: dumpRaw(msg),
    })),
    Threads:
      "threads" in comments
        ? {
            channelId: comments.channelId,
            threads: comments.threads.map((thread) => ({
              ...thread,
              authors: thread.authorIds.map(userName),
            })),
          }
        : comments,
    Versions: Array.isArray(versions)
      ? versions.map((version) => ({
          ...version,
          author: userName(version.authorId),
          created: new Date(version.createdMs).toISOString(),
        }))
      : versions,
  };
}
