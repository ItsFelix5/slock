import { timingSafeEqual } from "node:crypto";
import { type Action, perform } from "./actions";
import { claimUploads, reserveUpload } from "./reservations";
import { hasWorkspace } from "./slack";

const PORT = Number(Bun.env.PORT) || 5176;
const MAX_AGE_SECONDS = 300;
const signingSecret = Bun.env.SLACK_SIGNING_SECRET;
if (!signingSecret) throw new Error("SLACK_SIGNING_SECRET is required");

function isFromSlack(req: Request, raw: string) {
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_AGE_SECONDS) return false;
  const expected = Buffer.from(
    `v0=${new Bun.CryptoHasher("sha256", signingSecret).update(`v0:${timestamp}:${raw}`).digest("hex")}`,
  );
  const actual = Buffer.from(req.headers.get("x-slack-signature") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseAction(text: string): Action | undefined {
  try {
    return JSON.parse(text);
  } catch {}
}

async function execute(form: URLSearchParams) {
  const team = form.get("team_id") ?? "";
  const action = parseAction(form.get("text") ?? "");
  if (!(action && hasWorkspace(team))) return "invalid_command";
  if ("files" in action && action.files && !claimUploads(action.files.map((file) => file.id))) {
    return "upload_expired";
  }
  return await perform(team, form.get("channel_id") ?? "", form.get("user_id") ?? "", action);
}

async function runAndReport(form: URLSearchParams) {
  const error = await execute(form).catch(() => "invalid_command");
  if (!error) return;
  await fetch(form.get("response_url") ?? "", {
    body: JSON.stringify({ response_type: "ephemeral", text: `Relay failed: ${error}` }),
    method: "POST",
  });
}

async function readJson(req: Request) {
  try {
    return JSON.parse(await req.text());
  } catch {
    return {};
  }
}

async function handleReserve(req: Request) {
  const { team, filename, length } = await readJson(req);
  if (!(hasWorkspace(team) && typeof filename === "string" && typeof length === "string")) {
    return Response.json({ error: "invalid_request", ok: false }, { status: 400 });
  }
  const reply = await reserveUpload(team, filename, length);
  return Response.json(reply, { status: reply.ok ? 200 : 502 });
}

async function handle(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (req.method === "POST" && pathname === "/reserve") return handleReserve(req);
  if (pathname !== "/slack/command" || req.method !== "POST") {
    return new Response(null, { status: 404 });
  }
  const raw = await req.text();
  if (!isFromSlack(req, raw)) return new Response(null, { status: 401 });
  void runAndReport(new URLSearchParams(raw));
  return new Response();
}

Bun.serve({ fetch: handle, hostname: "0.0.0.0", port: PORT });

console.log(`relay: http://localhost:${PORT}`);
