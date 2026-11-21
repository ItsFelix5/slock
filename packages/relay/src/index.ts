import { timingSafeEqual } from "node:crypto";
import { type Action, perform } from "./actions";
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

function parseAction(text: string): Action | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function runAndReport(form: URLSearchParams) {
  const team = form.get("team_id") ?? "";
  const action = parseAction(form.get("text") ?? "");
  const error =
    action && hasWorkspace(team)
      ? await perform(team, form.get("channel_id") ?? "", form.get("user_id") ?? "", action)
      : "invalid_command";
  if (!error) return;
  await fetch(form.get("response_url") ?? "", {
    body: JSON.stringify({ response_type: "ephemeral", text: `Relay failed: ${error}` }),
    method: "POST",
  });
}

async function handle(req: Request): Promise<Response> {
  if (new URL(req.url).pathname !== "/slack/command" || req.method !== "POST") {
    return new Response(null, { status: 404 });
  }
  const raw = await req.text();
  if (!isFromSlack(req, raw)) return new Response(null, { status: 401 });
  void runAndReport(new URLSearchParams(raw));
  return new Response();
}

Bun.serve({ fetch: handle, hostname: "0.0.0.0", port: PORT });

console.log(`relay: http://localhost:${PORT}`);
