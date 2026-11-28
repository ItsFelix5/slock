import { afterEach, beforeEach, expect, test } from "bun:test";
import { ch, stamp } from "../../../../support/slack";
import { createStoreHarness, type StoreHarness, settle } from "./storeHarness";

const C1 = ch("C1");
const THREAD = stamp("1700000000.000100");

let h: StoreHarness;

beforeEach(async () => {
  h = await createStoreHarness();
});

afterEach(() => h.dispose());

test("subscribing again clears the unsubscribed mark", async () => {
  void h.store.unsubscribeFromThread(C1, THREAD);
  await settle();
  expect(h.store.isThreadUnsubscribed(C1, THREAD)).toBe(true);

  void h.store.toggleThreadSubscribed(C1, THREAD);
  await settle();
  expect(h.store.isThreadUnsubscribed(C1, THREAD)).toBe(false);
});

test("a failed unsubscribe leaves the thread marked subscribed", async () => {
  h.env.fetch.respond(
    () => true,
    () => new Response(JSON.stringify({ error: "nope", ok: false }), { status: 400 }),
  );
  void h.store.unsubscribeFromThread(C1, THREAD);
  await settle();
  expect(h.store.isThreadUnsubscribed(C1, THREAD)).toBe(false);
});
