import { beforeEach, describe, expect, test } from "bun:test";
import {
  fetchMessagesByIds,
  invalidateMessageLookup,
  primeMessageLookup,
} from "../../../../packages/plugins/src/slack/client/api/messageLookup";
import { createFakeEnv, type FakeEnv } from "../../../support/core";
import { elapse, startQueryHost } from "../../../support/queryHost";
import { ch, stamp } from "../../../support/slack";

const ref = { channelId: ch("C1"), ts: stamp("2.000000") };
const live = { channel: "C1", text: "live", ts: "2.000000", type: "message", user: "U2" } as const;

let env: FakeEnv;

beforeEach(async () => {
  env = createFakeEnv();
  env.fetch.respond(
    () => true,
    () => Response.json({ messages: {}, ok: true }),
  );
  await startQueryHost(env);
});

const text = async () => (await fetchMessagesByIds([ref])).get(`${ref.channelId}:${ref.ts}`)?.text;

describe("live messages", () => {
  test("answer later lookups without a request", async () => {
    primeMessageLookup(live);
    expect(await text()).toBe("live");
    primeMessageLookup({
      channel: "C1",
      message: { ...live, text: "edited" },
      subtype: "message_changed",
      type: "message",
    });
    expect(await text()).toBe("edited");
    primeMessageLookup({
      channel: "C1",
      deleted_ts: "2.000000",
      subtype: "message_deleted",
      type: "message",
    });
    expect(await text()).toBeUndefined();
    expect(env.fetch.calls).toHaveLength(0);
  });

  test("are looked up again after a reaction changes them", async () => {
    primeMessageLookup(live);
    invalidateMessageLookup(ref.channelId, ref.ts);
    const lookedUp = text();
    await elapse(env, 100);
    await lookedUp;
    expect(env.fetch.calls).toHaveLength(1);
  });
});
