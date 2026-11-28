import type { Services } from "@slock/core/types";
import { createEffect, createRoot, flush } from "solid-js";
import { createFakeEnv, partialService } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { ch } from "../../../support/slack";

export async function settle() {
  for (let i = 0; i < 40; i++) {
    await Promise.resolve();
    flush();
  }
}

export const reply = (body: object) =>
  new Response(JSON.stringify({ ok: true, ...body }), { status: 200 });

export function watch<T>(read: () => T): () => T | undefined {
  let latest: T | undefined;
  createRoot(() =>
    createEffect(read, (value) => {
      latest = value;
    }),
  );
  flush();
  return () => latest;
}

export async function canvasHost() {
  const env = createFakeEnv(1, 1_000_000);
  let tabs = ["F1"];
  env.fetch.respond("/api/channels/C1/view", () =>
    reply({
      channel: {
        id: "C1",
        name: "general",
        properties: {
          tabs: tabs.map((file_id) => ({ data: { file_id }, label: "", type: "canvas" })),
        },
      },
      users: [],
    }),
  );
  const host = await startQueryHost(env);
  const panes = partialService<Services["shell.panes"]>({
    openInNewPane: () => "pane",
    setPaneContent: () => {},
  });
  return {
    channel: ch("C1"),
    env,
    host,
    panes,
    requests: (part: string) => env.fetch.calls.filter((call) => call.url.includes(part)).length,
    setTabs: (...next: string[]) => {
      tabs = next;
    },
  };
}
