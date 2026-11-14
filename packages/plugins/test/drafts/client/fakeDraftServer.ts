import type { DraftEntry } from "@slock/types";

export type DraftCall = { method: string; path: string; body: Record<string, unknown> };

export function fakeDraftServer(initial: DraftEntry[] = []) {
  const calls: DraftCall[] = [];
  let clock = 100;
  let nextId = 1;
  let releaseList: () => void = () => {};
  let listGate: Promise<void> | undefined;
  let writeGate: Promise<void> | undefined;
  const state = { drafts: [...initial], failList: false, failSave: false };

  const originalFetch = globalThis.fetch;
  const handler = async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    calls.push({ body, method, path });
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
      const entry: DraftEntry = {
        blocks: body.blocks as DraftEntry["blocks"],
        channelId: String(body.channelId),
        clientMsgId: String(body.clientMsgId),
        id,
        lastUpdatedTs: String(clock++),
        threadTs: body.threadTs as string | undefined,
      };
      state.drafts = [...state.drafts.filter((d) => d.id !== id), entry];
      return reply({ id, lastUpdatedTs: entry.lastUpdatedTs });
    }
    state.drafts = state.drafts.filter((d) => d.id !== path.split("/").pop());
    return reply({});
  };
  globalThis.fetch = Object.assign(handler, { preconnect: () => {} });

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
      globalThis.fetch = originalFetch;
    },
    state,
  };
}
