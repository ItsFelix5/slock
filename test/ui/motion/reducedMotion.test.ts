import { expect, test } from "bun:test";
import { join } from "node:path";

const REPO = join(import.meta.dir, "../../..");
const KEYFRAMES_BLOCK = /@keyframes[\s\S]*?\n\}/g;

test("keyframes that move an element have a reduced-motion guard", async () => {
  const offenders: string[] = [];
  for await (const file of new Bun.Glob("packages/*/src/**/*.css").scan({
    cwd: REPO,
  })) {
    const css = await Bun.file(join(REPO, file)).text();
    const moves = (css.match(KEYFRAMES_BLOCK) ?? []).some((block) => block.includes("transform"));
    if (moves && !css.includes("prefers-reduced-motion")) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});
