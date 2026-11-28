import { afterAll, expect, test } from "bun:test";
import { relay } from "../../packages/central/src/relay";

const SECRET = "shh";
const handler = relay(SECRET);

function signed(body: string, { age = 0, secret = SECRET, path = "/slack/command" } = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000) - age);
  const signature = `v0=${new Bun.CryptoHasher("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
  const req = new Request(`http://central${path}`, {
    body,
    headers: { "x-slack-request-timestamp": timestamp, "x-slack-signature": signature },
    method: "POST",
  });
  return handler(req, new URL(req.url));
}

const replies: string[] = [];
const slack = Bun.serve({
  async fetch(req) {
    replies.push(await req.text());
    return new Response();
  },
  port: 0,
});

// Unknown workspaces make the relay stop before it ever reaches Slack.
const form = new URLSearchParams({ response_url: String(slack.url), team_id: "T0" }).toString();

afterAll(() => slack.stop(true));

test("a correctly signed command is accepted and failures are reported back to the user", async () => {
  expect((await signed(form))?.status).toBe(200);
  await Bun.sleep(50);
  expect(JSON.parse(replies[0] ?? "")).toEqual({
    response_type: "ephemeral",
    text: "Relay failed: invalid_command",
  });
});

test("a wrong secret or a stale timestamp is rejected", async () => {
  expect((await signed(form, { secret: "other" }))?.status).toBe(401);
  expect((await signed(form, { age: 600 }))?.status).toBe(401);
});

test("only the slash command route is claimed", async () => {
  expect(await signed(form, { path: "/settings" })).toBeUndefined();
  const get = new Request("http://central/slack/command");
  expect(await handler(get, new URL(get.url))).toBeUndefined();
});
