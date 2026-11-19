import { errorMessage } from "@slock/core";
import {
  fetchCanvasComments,
  fetchCanvasRaw,
  fetchCanvasVersions,
  resolveCanvasFile,
} from "../../canvas/client/api";
import { decodeLoadData, dumpRaw } from "../../canvas/protocol/api";

async function settle<T>(promise: Promise<T>): Promise<T | { error: string }> {
  try {
    return await promise;
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

function toHex(bytes: Uint8Array, limit: number): string {
  const head = Array.from(bytes.slice(0, limit), (b) => b.toString(16).padStart(2, "0"));
  return head.join(" ") + (bytes.length > limit ? ` ... (${bytes.length - limit} more)` : "");
}

export async function loadCanvasDebug(fileId: string) {
  const [raw, file, comments, versions] = await Promise.all([
    settle(fetchCanvasRaw(fileId)),
    settle(resolveCanvasFile(fileId)),
    settle(fetchCanvasComments(fileId)),
    settle(fetchCanvasVersions(fileId)),
  ]);
  const decoded = "bytes" in raw ? decodeLoadData(raw.bytes) : null;

  return {
    comments,
    file,
    meta: decoded?.meta ?? null,
    raw:
      "bytes" in raw
        ? {
            base64: btoa(Array.from(raw.bytes, (b) => String.fromCharCode(b)).join("")),
            bytes: raw.bytes.length,
            editable: raw.editable,
            hexHead: toHex(raw.bytes, 256),
          }
        : raw,
    records: (decoded?.records ?? []).map(({ msg, ...record }) => ({
      ...record,
      fields: dumpRaw(msg),
    })),
    versions,
  };
}
