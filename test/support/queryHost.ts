import { createHost, type PluginDef } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { provideUi } from "@slock/ui";
import { createEffect, createRoot, flush } from "solid-js";
import querySetup from "../../packages/plugins/src/query/client";
import { createFakeEnv } from "./core";

export async function startQueryHost(env = createFakeEnv(), ...plugins: PluginDef[]) {
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "ui", setup: provideUi },
    { id: "query", setup: querySetup },
    ...plugins,
  );
  return host;
}

export async function settle() {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flush();
  }
}

export async function elapse(env: { advance(ms: number): void }, ms: number) {
  for (let step = 0; step < 8; step++) {
    env.advance(step === 0 ? ms : 1_000);
    await settle();
  }
}

export function watch(read: () => unknown) {
  return createRoot((dispose) => {
    createEffect(read, () => {});
    return dispose;
  });
}

export const jsonReply = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status });
