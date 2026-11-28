import { timingSafeEqual } from "node:crypto";
import type { Handler } from "../server";
import { type Action, perform } from "./actions";
import { hasWorkspace } from "./slack";

const MAX_AGE_SECONDS = 300;

function isFromSlack(signingSecret: string, req: Request, raw: string) {
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

/** Performs actions on behalf of Slack users that arrive as signed slash commands. */
export function relay(signingSecret: string): Handler {
  return async (req, url) => {
    if (url.pathname !== "/slack/command" || req.method !== "POST") return;
    const raw = await req.text();
    if (!isFromSlack(signingSecret, req, raw)) return new Response(null, { status: 401 });
    runAndReport(new URLSearchParams(raw)).catch((error) => console.error("relay:", error));
    return new Response();
  };
}
