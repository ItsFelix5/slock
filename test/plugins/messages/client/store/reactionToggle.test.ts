import { describe, expect, test } from "bun:test";
import { defined } from "@slock/core";
import { ch, stamp } from "../../../../support/slack";
import { createStoreHarness, OTHER, settle } from "./storeHarness";

const CHANNEL = ch("C1");

async function toggleTwice(refusals: number) {
  const h = await createStoreHarness();
  const ts = stamp(h.slack.say(CHANNEL, OTHER, "hello").ts);
  h.open(CHANNEL);
  await h.store.loadRecentHistory(CHANNEL);
  await settle();
  const message = () => defined(h.messages(CHANNEL).find((m) => m.ts === ts));
  h.slack.failNextReactions(refusals);
  const toggles = [h.store.reactToMessage(CHANNEL, message(), "tada")];
  toggles.push(h.store.reactToMessage(CHANNEL, message(), "tada"));
  await Promise.all(toggles);
  await settle();
  const shown = message().reactions?.find((r) => r.name === "tada")?.users ?? [];
  const server = h.slack.reactionUsers(CHANNEL, ts, "tada");
  await h.dispose();
  return { server, shown: [...shown] };
}

describe("reaction toggles", () => {
  test("two refused toggles show what the server has", async () => {
    expect(await toggleTwice(2)).toEqual({ server: [], shown: [] });
  });

  test("a refused first toggle still lets the second one settle", async () => {
    expect(await toggleTwice(1)).toEqual({ server: [], shown: [] });
  });

  test("accepted toggles end where the last one asked", async () => {
    expect(await toggleTwice(0)).toEqual({ server: [], shown: [] });
  });
});
