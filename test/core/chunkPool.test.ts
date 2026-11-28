import { expect, test } from "bun:test";
import { createChunkPool } from "../../packages/core/src/host/chunkPool";

test("urgent chunks start before queued background chunks", async () => {
  const loadChunk = createChunkPool();
  const started: string[] = [];
  const releases: (() => void)[] = [];
  const hold = (name: string) => () =>
    new Promise<string>((resolve) => {
      started.push(name);
      releases.push(() => resolve(name));
    });
  const all = [
    ...["a", "b", "c"].map((name) => loadChunk(hold(name), "background")),
    loadChunk(hold("background"), "background"),
    loadChunk(hold("urgent")),
  ];
  releases[0]?.();
  await all[0];
  await Bun.sleep(0);
  expect(started).toEqual(["a", "b", "c", "urgent"]);
  releases[1]?.();
  await all[1];
  await Bun.sleep(0);
  expect(started).toEqual(["a", "b", "c", "urgent", "background"]);
  for (const release of releases) release();
  await Promise.all(all);
});
