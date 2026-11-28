import { expect, test } from "bun:test";
import type { Authenticate, Identity } from "../../packages/central/src/auth";
import { openDatabase } from "../../packages/central/src/db";
import { settings } from "../../packages/central/src/settings";
import { createSettingsStore, MAX_KEYS } from "../../packages/central/src/settings/store";

const felix: Identity = { team: "T1", user: "U1" };
const other: Identity = { team: "T1", user: "U2" };
const elsewhere: Identity = { team: "T2", user: "U1" };

function setup() {
  const store = createSettingsStore(openDatabase(":memory:"));
  let who: Identity | undefined = felix;
  const authenticate: Authenticate = () => who;
  const handler = settings(store, authenticate);
  async function call(path: string, method = "GET", body?: string) {
    const req = new Request(`http://central${path}`, { body, method });
    return (await handler(req, new URL(req.url))) ?? new Response(null, { status: 404 });
  }
  function as(next: Identity | undefined) {
    who = next;
  }
  return { as, call, store };
}

test("settings round trip as JSON values", async () => {
  const { call } = setup();
  expect((await call("/settings/theme", "PUT", '{"dark":true}')).status).toBe(204);
  expect((await call("/settings/count", "PUT", "3")).status).toBe(204);
  expect(await (await call("/settings")).json()).toEqual({
    settings: { count: 3, theme: { dark: true } },
  });
});

test("writing a key again replaces it and deleting removes it", async () => {
  const { call } = setup();
  await call("/settings/a", "PUT", "1");
  await call("/settings/a", "PUT", "2");
  expect(await (await call("/settings")).json()).toEqual({ settings: { a: 2 } });
  expect((await call("/settings/a", "DELETE")).status).toBe(204);
  expect(await (await call("/settings")).json()).toEqual({ settings: {} });
});

test("settings are separate per user and per workspace", async () => {
  const { call, as } = setup();
  await call("/settings/a", "PUT", "1");
  for (const stranger of [other, elsewhere]) {
    as(stranger);
    expect(await (await call("/settings")).json()).toEqual({ settings: {} });
  }
});

test("unauthenticated requests are rejected before anything is touched", async () => {
  const { call, as, store } = setup();
  as(undefined);
  for (const [path, method] of [
    ["/settings", "GET"],
    ["/settings/a", "PUT"],
    ["/settings/a", "DELETE"],
  ]) {
    expect((await call(path ?? "", method, "1")).status).toBe(401);
  }
  expect(store.all(felix)).toEqual({});
});

test("bad keys, bodies and methods are refused", async () => {
  const { call, store } = setup();
  expect((await call("/settings/a%20b", "PUT", "1")).status).toBe(400);
  expect((await call("/settings/%E0%A4%A", "PUT", "1")).status).toBe(400);
  expect((await call(`/settings/${"k".repeat(65)}`, "PUT", "1")).status).toBe(400);
  expect((await call("/settings/a", "PUT", "{nope")).status).toBe(400);
  expect((await call("/settings/a", "PUT", JSON.stringify("x".repeat(70_000)))).status).toBe(400);
  expect((await call("/settings", "PUT", "1")).status).toBe(405);
  expect((await call("/settings/a", "POST", "1")).status).toBe(405);
  expect(store.all(felix)).toEqual({});
});

test("a user cannot hold more than the maximum number of keys, but may update existing ones", async () => {
  const { call } = setup();
  for (let i = 0; i < MAX_KEYS; i++) await call(`/settings/k${i}`, "PUT", "1");
  expect((await call("/settings/extra", "PUT", "1")).status).toBe(409);
  expect((await call("/settings/k0", "PUT", "2")).status).toBe(204);
  await call("/settings/k1", "DELETE");
  expect((await call("/settings/extra", "PUT", "1")).status).toBe(204);
});

test("other paths are left to other features", async () => {
  const { call } = setup();
  expect((await call("/slack/command", "POST")).status).toBe(404);
  expect((await call("/settingsX")).status).toBe(404);
});
