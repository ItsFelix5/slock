import { dirname, join } from "node:path";
import type { BunPlugin } from "bun";
import { definitionMeta, providedIds } from "./bootModule";
import { runBuild } from "./outputs";
import { RESOLVE_FROM } from "./paths";
import { unitResolver } from "./resolve";
import { halvesOf, type Unit, unitInfo } from "./units";
import { virtualModule } from "./virtual";

const ENTRY_ID = "virtual:server";
const DEV_BUILD = "@slock/installer/dev";

const WORKSPACE_PACKAGE = /^@slock\/(?!plugins\/|installer\/dev$)/;

const workspaceResolver: BunPlugin = {
  name: "workspace-packages",
  setup(build) {
    build.onResolve({ filter: WORKSPACE_PACKAGE }, ({ path }) => ({
      path: Bun.resolveSync(path, RESOLVE_FROM),
    }));
  },
};

export function serverModule(units: Unit[]): string {
  const withServer = units.flatMap((unit) => {
    const { serverEntry } = halvesOf(unit.dir);
    return serverEntry ? [{ entry: serverEntry, unit }] : [];
  });
  const present = providedIds(withServer.map(({ unit }) => unit));
  const imports = withServer.map(
    ({ entry }, index) => `import setup${index} from ${JSON.stringify(entry)};`,
  );
  const defs = withServer.map(
    ({ unit }, index) =>
      `{ ...${JSON.stringify(definitionMeta(unit, present))}, setup: setup${index} }`,
  );
  const info = JSON.stringify(units.map(unitInfo));
  return `import { dirname } from "node:path";
import { startServer } from "@slock/server";
${imports.join("\n")}
const root = dirname(Bun.main);
startServer({
  clientDir: root + "/client",
  dataDir: root + "/data",
  plugins: [${defs.join(",\n")}],
  units: ${info},
});
`;
}

export async function linkServer(units: Unit[], outFile: string): Promise<void> {
  const roots = new Map(units.map((unit) => [unit.manifest.id, unit.dir]));
  const outputs = await runBuild({
    entrypoints: [ENTRY_ID],
    external: [DEV_BUILD],
    minify: true,
    naming: "server.js",
    plugins: [
      unitResolver(roots),
      workspaceResolver,
      virtualModule(ENTRY_ID, () => serverModule(units)),
    ],
    sourcemap: "none",
    target: "bun",
  });
  const [artifact] = outputs;
  if (!artifact) throw new Error("Server build produced no output");
  await Bun.write(join(dirname(outFile), "server.js"), artifact);
}
