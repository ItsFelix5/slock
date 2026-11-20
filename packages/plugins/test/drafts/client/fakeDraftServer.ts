import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, type FakeEnv } from "@slock/core/testing";
import { ch, stamp } from "@slock/slack/testing";
import type { Block, DraftEntry } from "@slock/types";

type RequestBody = {
  blocks?: Block[];
  channelId?: string;
  clientMsgId?: string;
  draftId?: string;
  lastUpdatedTs?: string;
  threadTs?: string;
};

export type DraftCall = { method: string; path: string; body: Record<string, unknown> };

export function fakeDraftServer(initial: DraftEntry[] = [], hostEnv?: FakeEnv) {
  const calls: DraftCall[] = [];
  let clock = 100;
  let nextId = 1;
  let releaseList: () => void = () => {};
  let listGate: Promise<void> | undefined;
  let writeGate: Promise<void> | undefined;
  const state = { drafts: [...initial], failList: false, failSave: false };

  const env = hostEnv ?? createFakeEnv();
  const host = hostEnv ? undefined : createHost({ env, reactive: solidReactive });
  if (host) setHost(host);
  const handler = async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body: RequestBody = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    calls.push({ body: { ...body }, method, path });
    const reply = (payload: object) => Response.json({ ok: true, ...payload });
    if (method === "GET") {
      await listGate;
      if (state.failList) return Response.json({ error: "boom" }, { status: 500 });
      return reply({ drafts: state.drafts });
    }
    await writeGate;
    if (method === "PUT") {
      if (state.failSave) return Response.json({ error: "boom" }, { status: 500 });
      const existing = state.drafts.find(
        (d) => d.id === body.draftId || (!body.draftId && d.clientMsgId === body.clientMsgId),
      );
      const id = existing?.id ?? `D${nextId++}`;
      const lastUpdatedTs = stamp(String(clock++));
      const entry: DraftEntry = {
        blocks: body.blocks ?? [],
        channelId: ch(String(body.channelId)),
        clientMsgId: String(body.clientMsgId),
        id,
        lastUpdatedTs,
        threadTs: body.threadTs ? stamp(body.threadTs) : undefined,
      };
      state.drafts = [...state.drafts.filter((d) => d.id !== id), entry];
      return reply({ id, lastUpdatedTs });
    }
    const id = path.split("/").pop();
    const target = state.drafts.find((d) => d.id === id);
    if (target && Number(body.lastUpdatedTs ?? 0) < Number(target.lastUpdatedTs)) {
      return Response.json({ error: "draft_has_conflict", ok: false }, { status: 502 });
    }
    state.drafts = state.drafts.filter((d) => d.id !== id);
    return reply({});
  };
  env.fetch.respond(
    () => true,
    (call) => handler(call.url, call.init),
  );

  return {
    calls,
    holdList() {
      listGate = new Promise((resolve) => {
        releaseList = resolve;
      });
    },
    holdWrites() {
      let release = () => {};
      writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => {
        writeGate = undefined;
        release();
      };
    },
    releaseList: () => releaseList(),
    restore: () => {
      void host?.stop();
    },
    state,
  };
}
