import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { handOff } from "../src/token";
import { calls, handleApi, handleToken, installSlack, json, restoreSlack, who } from "./harness";

beforeEach(installSlack);
afterEach(restoreSlack);

describe("relay api routes", () => {
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

  test("redeems a handed-off token by its nonce", async () => {
    handOff("n-redeem-0123456789", "the-token");
    const res = await handleToken(json("POST", "/token", { nonce: "n-redeem-0123456789" }));
    expect(await res.json()).toEqual({ ok: true, token: "the-token" });
  });

  test("refuses to redeem without a valid nonce", async () => {
    for (const body of [{}, { nonce: "short" }, { nonce: 5 }]) {
      expect((await handleToken(json("POST", "/token", body))).status).toBe(404);
    }
  });
});
