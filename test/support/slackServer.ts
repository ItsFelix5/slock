import { afterEach, beforeEach, spyOn } from "bun:test";
import { createHost, type Setup } from "@slock/core";
import { setHost } from "@slock/core/solid";
import { runHttp } from "../../packages/core/src/server/http";
import type { Credentials } from "../../packages/plugins/src/slack/server/api/auth";

export const creds: Credentials = {
  domain: "team.slack.com",
  route: "T1",
  slackSession: "session",
  token: "xoxc-1",
};

type SlackCall = { method: string; params: URLSearchParams };

const API_PREFIX = /^\/(api|cache\/[^/]+)\//;

function bodyEntries(body: RequestInit["body"]) {
  if (body instanceof FormData) return [...body.entries()];
  const text = String(body);
  if (!text.startsWith("{")) return [...new URLSearchParams(text)];
  return Object.entries(JSON.parse(text)).map(([key, value]) => [
    key,
    typeof value === "string" ? value : JSON.stringify(value),
  ]);
}

export function fakeSlackServer(id: string, setup: Setup) {
  const calls: SlackCall[] = [];
  const replies: Record<string, object | ((params: URLSearchParams) => object)> = {};
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

  beforeEach(() => {
    calls.length = 0;
    for (const method of Object.keys(replies)) delete replies[method];
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(((
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      const method = new URL(String(input)).pathname.replace(API_PREFIX, "");
      const params = new URLSearchParams();
      for (const [key, value] of bodyEntries(init?.body)) params.append(String(key), String(value));
      calls.push({ method, params });
      const reply = replies[method] ?? { ok: true };
      return Promise.resolve(Response.json(typeof reply === "function" ? reply(params) : reply));
    }) as typeof fetch);
  });

  afterEach(() => fetchSpy.mockRestore());

  async function request(path: string, body?: object, method: string = body ? "POST" : "GET") {
    const host = createHost();
    setHost(host);
    await host.register({
      id: "slack",
      setup: (ctx) => ctx.provide("slack.inFlight", { pending: new Map() }),
    });
    await host.register({ id, setup });
    const url = new URL(`http://localhost${path}`);
    const req = new Request(url, { body: body ? JSON.stringify(body) : undefined, method });
    const res = await runHttp(host.items("http"), { creds, req, upgrade: () => false, url });
    return { json: await res?.json(), status: res?.status };
  }

  return {
    calls,
    replies,
    request,
    sent: (method: string) =>
      Object.fromEntries(calls.find((call) => call.method === method)?.params ?? []),
    slackMethods: () => calls.map((call) => call.method),
  };
}
