import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { defined } from "@slock/core";
import { safeTypeHeaders, slackAssetResponse } from "../../../src/slack/server/api/assets";
import type { Credentials } from "../../../src/slack/server/api/auth";

const CREDS: Credentials = {
  domain: "example.slack.com",
  route: "/",
  slackSession: "session",
  token: "token",
};
const FILE_URL = "https://files.slack.com/files-pri/T1-F1/pic.png";
const originalFetch = globalThis.fetch;
let requests: string[] = [];

function stubFetch(...replies: (Response | Error)[]) {
  requests = [];
  const handler = (input: string | URL | Request): Promise<Response> => {
    requests.push(String(input));
    const reply = defined(replies[Math.min(requests.length - 1, replies.length - 1)]);
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
  };
  globalThis.fetch = Object.assign(handler, { preconnect: () => {} });
}

const png = () => new Response("bytes", { headers: { "content-type": "image/png" } });

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("slackAssetResponse", () => {
  beforeEach(() => {
    requests = [];
  });

  test("a dropped connection is retried once", async () => {
    stubFetch(new Error("socket hang up"), png());
    const res = await slackAssetResponse(FILE_URL, CREDS, null, null);
    expect(res.status).toBe(200);
    expect(requests.length).toBe(2);
  });

  test("a Slack 5xx is retried once, then reported as a 502", async () => {
    stubFetch(new Response("busy", { status: 503 }), new Response("busy", { status: 503 }));
    const res = await slackAssetResponse(FILE_URL, CREDS, null, null);
    expect(res.status).toBe(502);
    expect(requests.length).toBe(2);
  });

  test("a 404 from Slack is not retried", async () => {
    stubFetch(new Response("gone", { status: 404 }));
    const res = await slackAssetResponse(FILE_URL, CREDS, null, null);
    expect(res.status).toBe(502);
    expect(requests.length).toBe(1);
  });

  test("a host outside Slack never leaves the server", async () => {
    stubFetch(png());
    const res = await slackAssetResponse("https://evil.example/pic.png", CREDS, null, null);
    expect(res.status).toBe(404);
    expect(requests.length).toBe(0);
  });
});

describe("safeTypeHeaders", () => {
  test("images are served inline with nosniff", () => {
    expect(safeTypeHeaders("image/png")).toEqual({
      "content-type": "image/png",
      "x-content-type-options": "nosniff",
    });
  });

  test("HTML and SVG are served as plain text, never as a page", () => {
    const asText = {
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    };
    expect(safeTypeHeaders("text/html")).toEqual(asText);
    expect(safeTypeHeaders("image/svg+xml")).toEqual(asText);
  });

  test("anything unknown is forced to download", () => {
    expect(safeTypeHeaders("application/x-msdownload")).toEqual({
      "content-disposition": "attachment",
      "content-type": "application/octet-stream",
    });
  });
});
