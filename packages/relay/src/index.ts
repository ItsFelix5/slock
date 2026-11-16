import { timingSafeEqual } from "node:crypto";
import { perform } from "./actions";
import { handleApi, json, parseCommand } from "./api";
import { hasWorkspace } from "./slack";
import { type Identity, mintToken, readToken, TOKEN_LIFETIME_MS } from "./token";

const PORT = Number(Bun.env.PORT) || 5176;
const MAX_AGE_SECONDS = 300;
const BEARER = /^Bearer (.+)$/;

function required(name: string) {
  const value = Bun.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const signingSecret = required("SLACK_SIGNING_SECRET");

function isFromSlack(req: Request, raw: string) {
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_AGE_SECONDS) return false;
  const expected = Buffer.from(
    `v0=${new Bun.CryptoHasher("sha256", signingSecret).update(`v0:${timestamp}:${raw}`).digest("hex")}`,
  );
  const actual = Buffer.from(req.headers.get("x-slack-signature") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function reply(form: URLSearchParams, text: string) {
  return fetch(form.get("response_url") ?? "", {
    body: JSON.stringify({ response_type: "ephemeral", text }),
    method: "POST",
  });
}

function tokenMessage(token: string) {
  const days = TOKEN_LIFETIME_MS / (24 * 60 * 60 * 1000);
  return `Your Slock relay token, valid for ${days} days. Paste it into Slock under Settings > Account > Relay and keep it private:\n\`${token}\``;
}

async function runCommand(form: URLSearchParams) {
  const who: Identity = { team: form.get("team_id") ?? "", user: form.get("user_id") ?? "" };
  const command = parseCommand(form.get("text") ?? "");
  if (!(command && hasWorkspace(who.team))) {
    await reply(form, "Relay failed: invalid_command");
  } else if (command === "token") {
    await reply(form, tokenMessage(mintToken(signingSecret, who)));
  } else {
    const outcome = await perform(who, form.get("channel_id") ?? "", command);
    if (!outcome.ok) await reply(form, `Relay failed: ${outcome.error}`);
  }
}

async function handleCommand(req: Request) {
  const raw = await req.text();
  if (!isFromSlack(req, raw)) return new Response(null, { status: 401 });
  void runCommand(new URLSearchParams(raw));
  return new Response();
}

function handle(req: Request): Promise<Response> | Response {
  if (new URL(req.url).pathname === "/slack/command") {
    return req.method === "POST" ? handleCommand(req) : new Response(null, { status: 404 });
  }
  const bearer = BEARER.exec(req.headers.get("authorization") ?? "")?.[1];
  const who = bearer && readToken(signingSecret, bearer);
  if (!(who && hasWorkspace(who.team))) return json({ error: "invalid_token", ok: false }, 401);
  return handleApi(req, who);
}

Bun.serve({ fetch: handle, hostname: "0.0.0.0", port: PORT });

console.log(`relay: http://localhost:${PORT}`);
