import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBase, linkClient } from "../../packages/installer/src/client";
import { RESOLVE_FROM } from "../../packages/installer/src/paths";
import { unitOf, writePlugin } from "./fixtures";

const BUILD_TIMEOUT = 180_000;

const root = mkdtempSync(join(tmpdir(), "installer-link-"));
afterAll(() => rmSync(root, { force: true, recursive: true }));

test(
  "a plugin cannot ship a second copy of a shared module",
  async () => {
    const inner = Bun.resolveSync("quill/blots/scroll", RESOLVE_FROM);
    const plugin = writePlugin(
      root,
      "doubled",
      { boot: true },
      {
        "client/index.ts": `import Scroll from ${JSON.stringify(inner)};\nexport default () => Scroll;\n`,
      },
    );
    const base = await buildBase(false);

    await expect(linkClient([unitOf(plugin)], base, false)).rejects.toThrow("Bundled twice");
  },
  BUILD_TIMEOUT,
);
