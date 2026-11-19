import { afterEach, describe, expect, test } from "bun:test";
import { apiGet } from "../src/client";
import { SlackError } from "../src/error";

const realFetch = globalThis.fetch;

function respondWith(respond: () => Response | Promise<Response>) {
  globalThis.fetch = Object.assign(() => Promise.resolve().then(respond), {
    preconnect: realFetch.preconnect,
  });
}

afterEach(() => {
  globalThis.fetch = realFetch;
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
