import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { calls, handleApi, installSlack, json, restoreSlack, who } from "./harness";

beforeEach(installSlack);
afterEach(restoreSlack);

describe("relay api routes", () => {
  test("identifies the token owner", async () => {
    const res = await handleApi(json("GET", "/me"), who);
    expect(await res.json()).toEqual({ ok: true, ...who });
  });

  test("rejects unknown routes", async () => {
    expect((await handleApi(json("GET", "/nope"), who)).status).toBe(404);
    expect((await handleApi(json("POST", "/channels/C1/messages/1.1", {}), who)).status).toBe(404);
    expect((await handleApi(json("PATCH", "/channels/C1/messages", {}), who)).status).toBe(404);
  });

  test("rejects malformed payloads", async () => {
    const res = await handleApi(json("POST", "/channels/C1/messages", { text: 5 }), who);
    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });
});
