import { createFakeEnv } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { ch } from "../../../support/slack";
import { createFuzz, type FaultRates, type ServedCall } from "../../fuzz/fuzzSlack";
import { blocks, mountComposer } from "./composerHarness";
import { fakeDraftServer } from "./fakeDraftServer";

export const CHANNEL = ch("C1");

const draftPath = /^\/api\/drafts\/([A-Za-z0-9]+)$/;

export async function createDraftsWorld(
  seed: number,
  trace: string[],
  rates?: Partial<FaultRates>,
) {
  const env = createFakeEnv(seed);
  const host = await startQueryHost(env);
  const server = await fakeDraftServer([], env);
  const composer = mountComposer(CHANNEL);
  const inflight: Promise<unknown>[] = [];
  let counter = 0;

  const onServed = ({ method, path }: ServedCall) => {
    if (method === "PUT") {
      const latest = server.state.drafts.at(-1);
      if (latest) fuzz.emit(`update ${latest.id}`, () => composer.store.applyRemote(latest));
      return;
    }
    const id = draftPath.exec(path)?.[1];
    if (method === "DELETE" && id) fuzz.emit(`delete ${id}`, () => composer.store.removeRemote(id));
  };
  const fuzz = createFuzz({ env, onServed, rates, seed, trace });
  inflight.push(composer.store.hydrate().catch(() => false));

  return {
    clear: () => composer.setCurrent(blocks("")),
    composer,
    env,
    fuzz,
    async dispose() {
      composer.dispose();
      await host.stop();
    },
    send() {
      inflight.push(composer.state.clearAfterSend({ clear: () => {} }));
      composer.setCurrent(blocks(""));
    },
    server,
    async settle() {
      for (let round = 0; round < 4; round++) {
        await fuzz.drain();
        await Promise.all(inflight);
        composer.env.advance(1000);
      }
      await fuzz.drain();
      await Promise.all(inflight);
    },
    tick: () => composer.env.advance(1000),
    type: () => composer.setCurrent(blocks(`text ${++counter}`)),
  };
}

export type DraftsWorld = Awaited<ReturnType<typeof createDraftsWorld>>;
