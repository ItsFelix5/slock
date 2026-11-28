import { defined } from "@slock/core";
import type { GatewayMessageEvent, Message, RawMessage, Ts } from "@slock/types";
import { createFakeEnv } from "../../../../support/core";
import { ch, stamp } from "../../../../support/slack";
import { createFuzz, type FaultRates, type ServedCall } from "../../../fuzz/fuzzSlack";
import { createStoreHarness, ME, OTHER } from "./storeHarness";

export const CHANNEL = ch("C1");

type Ledger = {
  added: Set<Ts>;
  deleted: Set<Ts>;
  droppedDeletes: Set<Ts>;
  tainted: Set<Ts>;
};

const reactionPath = /^\/api\/messages\/([A-Z0-9]+)\/([0-9.]+)\/reactions$/;
const channelPath = /^\/api\/channels\/[A-Z0-9]+\/messages(?:\/([0-9.]+))?$/;

export async function createMessagesWorld(
  seed: number,
  trace: string[],
  seedCount: number,
  rates?: Partial<FaultRates>,
) {
  const env = createFakeEnv(seed);
  const h = await createStoreHarness(env);
  const ledger: Ledger = {
    added: new Set(),
    deleted: new Set(),
    droppedDeletes: new Set(),
    tainted: new Set(),
  };
  const inflight: Promise<unknown>[] = [];
  const intents = new Map<string, { name: string; ts: Ts; wanted: boolean }>();
  let counter = 0;

  const announce = (kind: "add" | "edit" | "delete", ts: Ts, event: GatewayMessageEvent) => {
    const accepted = fuzz.emit(`${kind} ${ts}`, () => {
      if (kind === "add") ledger.added.add(ts);
      if (kind === "delete") ledger.deleted.add(ts);
      h.deliver(event);
    });
    if (accepted) return;
    ledger.tainted.add(ts);
    if (kind === "delete") ledger.droppedDeletes.add(ts);
  };

  const announceReaction = (ts: Ts, name: string, added: boolean, user: typeof ME | typeof OTHER) =>
    fuzz.emit(`${added ? "react" : "unreact"} ${name} ${ts}`, () =>
      h.deliver(h.slack.reacted(CHANNEL, ts, name, user, added)),
    );

  const onServed = ({ body, method, path, reply }: ServedCall) => {
    const reaction = reactionPath.exec(path);
    if (reaction && typeof reply === "object" && reply && "ok" in reply && reply.ok && body) {
      const name = body && typeof body === "object" && "name" in body ? String(body.name) : "";
      announceReaction(stamp(reaction[2] ?? ""), name, method === "POST", ME);
      return;
    }
    const match = channelPath.exec(path);
    if (!(match && typeof reply === "object" && reply && "ok" in reply && reply.ok)) return;
    const [, rawTs] = match;
    if (method === "POST" && "ts" in reply && typeof reply.ts === "string") {
      const ts = stamp(reply.ts);
      const raw = defined(h.slack.serverMessages(CHANNEL).find((m) => m.ts === ts));
      announce("add", ts, h.slack.echo(CHANNEL, raw));
    } else if (method === "PATCH" && rawTs && body) {
      announce("edit", stamp(rawTs), h.slack.edited(CHANNEL, stamp(rawTs)));
    } else if (method === "DELETE" && rawTs) {
      announce("delete", stamp(rawTs), h.slack.deleted(CHANNEL, stamp(rawTs)));
    }
  };

  const fuzz = createFuzz({ env, onServed, rates, seed, trace });
  for (let i = 0; i < seedCount; i++) h.slack.say(CHANNEL, OTHER, `seed ${i}`);
  h.open(CHANNEL);

  const track = (promise: Promise<unknown>) => void inflight.push(promise.catch(() => undefined));
  const serverOf = (author: typeof ME | typeof OTHER): RawMessage[] =>
    h.slack.serverMessages(CHANNEL).filter((m) => m.user === author);
  const nth = <T>(items: T[], fraction: number) => items[Math.floor(fraction * items.length)];
  const nextText = (label: string) => `${label} ${++counter}`;

  return {
    deleteMine(fraction: number) {
      const target = nth(serverOf(ME), fraction);
      if (target) track(h.store.deleteMessageAt(CHANNEL, stamp(target.ts)));
    },
    dispose: () => h.dispose(),
    editMine(fraction: number) {
      const target = nth(serverOf(ME), fraction);
      if (target)
        track(h.store.editMessageText(CHANNEL, stamp(target.ts), nextText("mine edited")));
    },
    editOther(fraction: number) {
      const target = nth(serverOf(OTHER), fraction);
      if (!target) return;
      const ts = stamp(target.ts);
      h.slack.edit(CHANNEL, ts, nextText("edited"));
      announce("edit", ts, h.slack.edited(CHANNEL, ts));
    },
    env,
    fuzz,
    h,
    inflight,
    ledger,
    older: () => track(h.store.loadOlderMessages(CHANNEL)),
    intents,
    reactMine(fraction: number, name: string) {
      const target = nth(
        h.messages(CHANNEL).filter((m) => !m.pending),
        fraction,
      );
      if (!target) return;
      const had = target.reactions?.find((r) => r.name === name)?.users.includes(ME) ?? false;
      intents.set(`${target.ts}:${name}`, { name, ts: target.ts, wanted: !had });
      track(h.store.reactToMessage(CHANNEL, target, name));
    },
    reactOther(fraction: number, name: string) {
      const target = nth(serverOf(OTHER), fraction);
      if (!target) return;
      const ts = stamp(target.ts);
      const on = !h.slack.reactionUsers(CHANNEL, ts, name).includes(OTHER);
      h.slack.react(CHANNEL, ts, name, OTHER, on);
      announceReaction(ts, name, on, OTHER);
    },
    reconnect: () => h.onReconnect(),
    recent: () => track(h.store.loadRecentHistory(CHANNEL)),
    removeOther(fraction: number) {
      const target = nth(serverOf(OTHER), fraction);
      if (!target) return;
      const ts = stamp(target.ts);
      h.slack.remove(CHANNEL, ts);
      announce("delete", ts, h.slack.deleted(CHANNEL, ts));
    },
    say() {
      const raw = h.slack.say(CHANNEL, OTHER, nextText("live"));
      announce("add", stamp(raw.ts), h.slack.echo(CHANNEL, raw));
    },
    send: () => track(h.store.sendMessage(CHANNEL, nextText("sent"), [])),
    async settle() {
      await fuzz.drain();
      await Promise.all(inflight);
      await fuzz.drain();
    },
    visible: (): Message[] => h.messages(CHANNEL),
  };
}

export type MessagesWorld = Awaited<ReturnType<typeof createMessagesWorld>>;
