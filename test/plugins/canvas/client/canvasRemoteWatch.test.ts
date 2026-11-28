import { expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost } from "@slock/core/services";
import type { Services } from "@slock/core/types";
import { createRoot, createSignal, flush } from "solid-js";
import { watchRemoteChanges } from "../../../../packages/plugins/src/canvas/client/lib/canvasRemoteWatch";
import type { createCanvasSync } from "../../../../packages/plugins/src/canvas/client/lib/canvasSync";
import { createFakeEnv, partialService } from "../../../support/core";
import { fid } from "../../../support/slack";

test("refresh triggers share one request at a time", async () => {
  const env = createFakeEnv();
  const host = createHost({ env });
  setHost(host);
  await host.register({
    id: "realtime",
    setup: (ctx) =>
      ctx.provide("realtime", partialService<Services["realtime"]>({ watchFile: () => () => {} })),
  });
  const loads: (() => void)[] = [];
  const [tick, setTick] = createSignal(0);
  const dispose = createRoot((stop) => {
    watchRemoteChanges({
      fileId: fid("F1"),
      refresh: () => new Promise<void>((resolve) => loads.push(resolve)),
      remoteChangeTick: tick,
      sync: partialService<ReturnType<typeof createCanvasSync>>({ isPending: () => false }),
    });
    return stop;
  });
  flush();

  setTick(1);
  flush();
  document.dispatchEvent(new Event("visibilitychange"));
  env.advance(100);
  expect(loads).toHaveLength(1);

  setTick(2);
  flush();
  env.advance(100);
  expect(loads).toHaveLength(1);

  loads[0]?.();
  await Promise.resolve();
  expect(loads).toHaveLength(2);

  dispose();
  await host.stop();
});
