import { decodeLoadData, planEdit } from "@slock/canvas";
import type { CanvasEdit } from "@slock/types";
import type { Credentials } from "./auth.ts";
import { fetchCanvasRaw, postCanvas } from "./canvasRaw.ts";

export type CanvasEditResult = { ok: true } | { error: string; ok: false; status: number };

const CONFLICT_ERRORS = new Set(["unknown_anchor", "no_document", "opaque_block"]);

export async function applyCanvasEdit(
  threadId: string,
  edit: CanvasEdit,
  creds: Credentials,
): Promise<CanvasEditResult> {
  const raw = await fetchCanvasRaw(threadId, creds);
  if (!raw.ok) return { error: raw.error, ok: false, status: 502 };
  const plan = planEdit(decodeLoadData(raw.bytes), edit);
  if (!plan.ok)
    return { error: plan.error, ok: false, status: CONFLICT_ERRORS.has(plan.error) ? 409 : 400 };
  if (plan.writes === 0) return { ok: true };
  const response = await postCanvas(
    "edit-document",
    {
      data_binary: Buffer.from(plan.data).toString("base64"),
      document: plan.meta.documentId,
      retry_count: "0",
      sequence: "1",
      session: crypto.randomUUID().replaceAll("-", "").slice(0, 12),
      thread: plan.meta.threadId,
      ...(plan.title === null ? {} : { title: plan.title }),
    },
    creds,
  );
  if (response.ok) return { ok: true };
  console.error(`[canvas] edit-document failed: ${response.status} ${response.error}`);
  return response.status === 400
    ? { error: "invalid_content", ok: false, status: 422 }
    : { error: "slack_error", ok: false, status: 502 };
}
