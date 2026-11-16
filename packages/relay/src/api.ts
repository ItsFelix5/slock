import { type Action, type Outcome, perform } from "./actions";
import type { Identity } from "./token";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptional<T>(check: (value: unknown) => value is T) {
  return (value: unknown): value is T | undefined => value === undefined || check(value);
}

const isString = (value: unknown): value is string => typeof value === "string";
const isOptionalString = isOptional(isString);
const isOptionalBoolean = isOptional((value): value is boolean => typeof value === "boolean");
const isOptionalStrings = isOptional(
  (value): value is string[] => Array.isArray(value) && value.every(isString),
);

export function parseAction(raw: unknown, files: File[] = []): Action | undefined {
  if (!isRecord(raw)) return;
  const { action, blocks, fileIds, replyBroadcast, text, threadTs, ts, unfurl } = raw;
  const attached = files.length ? files : undefined;
  if (action === "delete") return isString(ts) ? { action, ts } : undefined;
  if (action === "edit") {
    return isString(ts) &&
      isOptionalString(text) &&
      isOptionalStrings(fileIds) &&
      isOptionalBoolean(replyBroadcast)
      ? { action, blocks, fileIds, files: attached, replyBroadcast, text, ts }
      : undefined;
  }
  if (action === "post") {
    return isOptionalString(text) &&
      isOptionalString(threadTs) &&
      isOptionalStrings(unfurl) &&
      isOptionalBoolean(replyBroadcast)
      ? { action, blocks, files: attached, replyBroadcast, text, threadTs, unfurl }
      : undefined;
  }
}

export function parseCommand(text: string): Action | "token" | undefined {
  if (text.trim() === "token") return "token";
  try {
    return parseAction(JSON.parse(text));
  } catch {}
}

const STATUS: Record<string, number> = {
  cant_update_message: 403,
  invalid_action: 400,
  invalid_file_ids: 400,
  not_a_channel_manager: 403,
};

export function json(body: object, status = 200) {
  return Response.json(body, { status });
}

function respond(outcome: Outcome) {
  return outcome.ok ? json(outcome) : json(outcome, STATUS[outcome.error] ?? 502);
}

async function readBody(req: Request): Promise<{ files: File[]; raw: object } | undefined> {
  try {
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const payload = form.get("payload");
      return {
        files: form.getAll("files").filter((part) => part instanceof File),
        raw: typeof payload === "string" ? JSON.parse(payload) : {},
      };
    }
    const text = await req.text();
    return { files: [], raw: text ? JSON.parse(text) : {} };
  } catch {}
}

const MESSAGES = /^\/channels\/([^/]+)\/messages(?:\/([^/]+))?$/;
const KINDS: Record<string, Action["action"]> = { DELETE: "delete", PATCH: "edit", POST: "post" };

export async function handleApi(req: Request, who: Identity): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (pathname === "/me" && req.method === "GET") return json({ ok: true, ...who });

  const [, channel = "", ts] = MESSAGES.exec(pathname) ?? [];
  const kind = KINDS[req.method];
  if (!(channel && kind) || (kind === "post") === !!ts) return new Response(null, { status: 404 });

  const body = await readBody(req);
  const action = body && parseAction({ ...body.raw, action: kind, ts }, body.files);
  if (!action) return json({ error: "invalid_action", ok: false }, 400);
  return respond(await perform(who, decodeURIComponent(channel), action));
}
