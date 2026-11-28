import { beforeEach, describe, expect, test } from "bun:test";
import { apiGet, apiPut } from "../../../packages/slack/src/client/requests";
import { SlackError } from "../../../packages/slack/src/error";
import { createFakeEnv } from "../../support/core";
import { startSlackHost } from "../../support/slack";

let env = createFakeEnv();

beforeEach(() => {
  env = startSlackHost();
});

function respondWith(respond: () => Response | Promise<Response>) {
  env.fetch.respond(
    () => true,
    () => Promise.resolve().then(respond),
  );
}

describe("keepalive", () => {
  test("is dropped for a body the browser would refuse to keep alive", async () => {
    respondWith(() => Response.json({ ok: true }));
    await apiPut("/x", { text: "short" }, { keepalive: true });
    await apiPut("/x", { text: "é".repeat(40_000) }, { keepalive: true });
    await apiPut("/x", { text: "short" });
    expect(env.fetch.calls.map((call) => call.init?.keepalive)).toEqual([true, false, false]);
  });
});

describe("api client errors", () => {
  test("a transport failure is a network error", async () => {
    const cause = new TypeError("fetch failed");
    respondWith(() => {
      throw cause;
    });
    const error = await apiGet("/x").catch((e) => e);
    expect(error).toBeInstanceOf(SlackError);
    expect(error).toMatchObject({ cause, kind: "network" });
  });

  test("a non-json failure is classified by status", async () => {
    respondWith(() => new Response("bad gateway", { status: 502 }));
    expect(await apiGet("/x").catch((e) => e)).toMatchObject({
      kind: "transient",
      message: "bad gateway",
    });
    respondWith(() => new Response("slow down", { status: 429 }));
    expect(await apiGet("/x").catch((e) => e)).toMatchObject({ kind: "rate_limited" });
  });

  test("a json failure comes back as a reply for the caller to classify", async () => {
    respondWith(() => Response.json({ error: "channel_not_found", ok: false }, { status: 404 }));
    expect(await apiGet("/x")).toEqual({ error: "channel_not_found", ok: false });
  });

  test("a failed status without an error field throws", async () => {
    respondWith(() => Response.json({}, { status: 500 }));
    expect(await apiGet("/x").catch((e) => e)).toMatchObject({ kind: "transient" });
  });

  test("a successful reply carries ok", async () => {
    respondWith(() => Response.json({ value: 1 }));
    expect(await apiGet<{ value: number }>("/x")).toEqual({ ok: true, value: 1 });
  });
});
