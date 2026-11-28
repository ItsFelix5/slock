import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { createHost, readManifest } from "@slock/core";
import { buildPlugin, libSpecifiers } from "@slock/installer";
import { setupOf } from "../../../packages/plugins/src/plugins/client/data/loadPlugin";

const EXAMPLE = resolve(import.meta.dir, "../../../examplePlugin");
const BUNDLE = resolve(EXAMPLE, "node_modules/.tmp/example.js");
const BARE_IMPORT = /(?:from|import)\s*["']([^./"'][^"']*)["']/g;

beforeAll(() => buildPlugin(resolve(EXAMPLE, "client/index.tsx"), BUNDLE));

describe("examplePlugin", () => {
  test("the built bundle only imports what the import map provides", async () => {
    const code = await Bun.file(BUNDLE).text();
    const imported = new Set([...code.matchAll(BARE_IMPORT)].flatMap((match) => match[1] ?? []));
    expect(imported.size).toBeGreaterThan(0);
    for (const specifier of imported) expect(libSpecifiers).toContain(specifier);
  });

  test("plugin.json is a valid manifest", async () => {
    const manifest = readManifest(
      await Bun.file(resolve(EXAMPLE, "plugin.json")).json(),
      "example",
    );
    expect(manifest.id).toBe("example");
  });

  test("loads into a host and contributes its points", async () => {
    const mod = await import(BUNDLE);
    const manifest = readManifest(mod.manifest, "example");
    const host = createHost();
    for (const id of manifest.requires ?? []) await host.register({ id, setup: () => {} });
    await host.register({ ...manifest, setup: setupOf(mod) });
    const seen: Record<string, number> = {};
    await host.register({
      id: "observer",
      requires: ["example"],
      setup: (ctx) => {
        for (const point of ["sidebar.toolbar", "settings.tab", "composer.suggest"] as const)
          seen[point] = ctx.use(point)().length;
      },
    });
    await host.start();
    expect(host.list().find(({ id }) => id === "example")?.status.state).toBe("running");
    expect(seen).toEqual({ "composer.suggest": 1, "settings.tab": 1, "sidebar.toolbar": 1 });
  });
});
