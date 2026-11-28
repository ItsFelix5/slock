import { service } from "@slock/core/services";
import { type Credentials, enterpriseIdFromRoute } from "@slock/plugins/slack/server/api/auth";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";
import type { CanvasAccess, CanvasEdit } from "@slock/types";
import {
  type ControlContext,
  decodeLoadData,
  onlyAnnotates,
  planEdit,
  readNodes,
} from "../protocol/api";
import type { CanvasWire } from "./wire";

type CanvasEditResult = { ok: true } | { error: string; ok: false; status: number };

const CONFLICT_ERRORS = new Set(["unknown_anchor", "no_document"]);

const emoji = service("emoji.server");

async function annotationAuthor(edit: CanvasEdit, creds: Credentials): Promise<string | null> {
  if (!edit.controls.some((control) => control.kind === "annotation")) return "";
  const reply = await callSlack<{ quip_user_id?: string }>("quip.getControllerInitData", {}, creds);
  return reply.ok ? (reply.quip_user_id ?? null) : null;
}

export async function controlContext(
  edit: CanvasEdit,
  creds: Credentials,
): Promise<ControlContext | null> {
  const viewerId = await annotationAuthor(edit, creds);
  if (viewerId === null) return null;
  const emojiUrls = new Map<string, string>();
  for (const control of edit.controls) {
    if (control.kind !== "emoji") continue;
    const url = await emoji.imageUrl(control.name, creds);
    if (url) emojiUrls.set(control.name, url);
  }
  const enterpriseId = enterpriseIdFromRoute(creds.route);
  return { domain: creds.domain, emojiUrls, enterpriseId, viewerId };
}

export async function applyCanvasEdit(
  wire: CanvasWire,
  target: {
    access: Exclude<CanvasAccess, "view">;
    context: ControlContext | null;
    raw: Uint8Array;
  },
  edit: CanvasEdit,
  creds: Credentials,
): Promise<CanvasEditResult> {
  const decoded = decodeLoadData(target.raw);
  if (target.access === "comment" && !onlyAnnotates(readNodes(decoded), edit))
    return { error: "not_editable", ok: false, status: 403 };
  if (!target.context) return { error: "slack_error", ok: false, status: 502 };
  const plan = planEdit(decoded, edit, target.context);
  if (!plan.ok)
    return { error: plan.error, ok: false, status: CONFLICT_ERRORS.has(plan.error) ? 409 : 400 };
  if (plan.writes === 0) return { ok: true };
  const response = await wire.post(
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
