import { expect, test } from "bun:test";
import type { Services } from "@slock/core/types";
import type { UserId } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import { createFakeEnv, partialService } from "../../../support/core";
import { elapse, jsonReply, settle, startQueryHost } from "../../../support/queryHost";
import { ch, uid } from "../../../support/slack";

const ids = [uid("U1"), uid("U2"), uid("U3"), uid("U4")];

async function start(list: { complete: boolean; people: number }) {
  const env = createFakeEnv(1, 1_000_000);
  env.fetch.respond(/\/people-count$/, () => jsonReply({ people: list.people }));
  env.fetch.respond(/\/people$/, () => jsonReply({ complete: list.complete, ids }));
  const asked: unknown[] = [];
  const [connected, setConnected] = createSignal(false);
  const [presence, setPresence] = createSignal<Partial<Record<UserId, "active" | "away">>>({});
  const host = await startQueryHost(env);
  await host.register({
    id: "services",
    setup: (ctx) => {
      ctx.provide(
        "realtime",
        partialService<Services["realtime"]>({
          gatewayConnected: connected,
          send: (payload) => asked.push(payload) > 0,
        }),
      );
      ctx.provide(
        "users",
        partialService<Services["users"]>({ knownPresence: (id) => presence()[id] }),
      );
    },
  });
  const { createHeadcount } = await import(
    "../../../../packages/plugins/src/channel-members/client/headcount"
  );
  const { dispose, headcount } = createRoot((dispose) => ({
    dispose,
    headcount: createHeadcount(() => ch("C1")),
  }));
  await settle();
  return {
    asked,
    connect: () => {
      setConnected(true);
      flush();
    },
    dispose,
    env,
    headcount,
    reply: (active: number) => {
      setPresence(
        Object.fromEntries(ids.map((id, index) => [id, index < active ? "active" : "away"])),
      );
      flush();
    },
  };
}

test("presence is asked once connected, then every minute until closed", async () => {
  const h = await start({ complete: true, people: 4 });
  expect(h.headcount.people()).toBe(4);
  expect(h.asked).toEqual([]);
  h.connect();
  expect(h.asked).toEqual([{ ids, type: "query_presence" }]);
  expect(h.headcount.online()).toBeUndefined();
  h.reply(3);
  expect(h.headcount.online()).toBe("3");
  await elapse(h.env, 60_000);
  expect(h.asked).toHaveLength(2);
  h.dispose();
  await elapse(h.env, 120_000);
  expect(h.asked).toHaveLength(2);
});

test("nobody online reads as zero", async () => {
  const h = await start({ complete: true, people: 4 });
  h.reply(0);
  expect(h.headcount.online()).toBe("0");
  h.dispose();
});

test("a partial list is scaled up to every person and marked approximate", async () => {
  const h = await start({ complete: false, people: 1000 });
  h.reply(1);
  expect(h.headcount.online()).toBe("~250");
  h.dispose();
});
