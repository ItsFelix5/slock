import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildBase, type ClientBuild, linkClient } from "./client";
import { formatBytes } from "./confirm";
import { linkServer } from "./linkServer";
import { PUBLIC_DIR } from "./paths";
import type { Plan } from "./plan";
import { writePrecompressed } from "./precompress";
import { type Unit, writeUnitManifest } from "./units";

const SWAPPED = ["plugins", "client", "server.js", "package.json"];
const INSTANCE_PACKAGE = { scripts: { start: "bun server.js" } };

export const instancePaths = (dir: string) => ({
  data: join(dir, "data"),
  next: join(dir, ".next"),
  plugins: join(dir, "plugins"),
  previous: join(dir, ".previous"),
  root: dir,
});

export async function recover(dir: string): Promise<void> {
  const { previous, root } = instancePaths(dir);
  if (!existsSync(previous)) return;
  for (const name of await readdir(previous)) {
    await rm(join(root, name), { force: true, recursive: true });
    await rename(join(previous, name), join(root, name));
  }
  await rm(previous, { force: true, recursive: true });
}

async function installDependencies(next: string, plan: Plan): Promise<void> {
  const wanted = new Map<string, string>();
  for (const { manifest, meta } of plan.result)
    for (const [name, range] of Object.entries(meta.dependencies)) {
      const other = wanted.get(name);
      if (other && other !== range)
        throw new Error(`${manifest.id} wants ${name}@${range} but another plugin wants ${other}`);
      wanted.set(name, range);
    }
  if (wanted.size === 0) return;
  await Bun.write(
    join(next, "package.json"),
    JSON.stringify({ dependencies: Object.fromEntries(wanted) }),
  );
  const install = Bun.spawn([process.execPath, "install", "--production", "--ignore-scripts"], {
    cwd: next,
    stderr: "inherit",
    stdout: "inherit",
  });
  if ((await install.exited) !== 0) throw new Error("dependency install failed");
}

async function writeFile(path: string, contents: Blob) {
  await Bun.write(path, contents);
  await writePrecompressed(path, contents);
}

async function writeClient(dir: string, client: ClientBuild) {
  const pages = [
    ["index.html", false],
    ["index.bootstrap.html", true],
  ] as const;
  await Promise.all([
    ...[...client.files].map(([url, { contents }]) => writeFile(join(dir, url), contents)),
    ...pages.map(([name, preload]) =>
      writeFile(join(dir, name), new Blob([client.html(preload)], { type: "text/html" })),
    ),
  ]);
  await cp(PUBLIC_DIR, join(dir, "public"), { recursive: true });
}

async function assemble(dir: string, plan: Plan): Promise<void> {
  const { next } = instancePaths(dir);
  await rm(next, { force: true, recursive: true });
  await mkdir(join(next, "plugins"), { recursive: true });
  const units: Unit[] = [];
  for (const unit of plan.result) {
    const copy = { ...unit, dir: join(next, "plugins", unit.manifest.id) };
    await cp(unit.dir, copy.dir, { recursive: true });
    await writeUnitManifest(copy);
    units.push(copy);
  }
  await installDependencies(next, plan);
  const base = await buildBase(true);
  const client = await linkClient(units, base, true);
  await linkServer(units, join(next, "server.js"));
  await writeClient(join(next, "client"), client);
  await rm(join(next, "node_modules"), { force: true, recursive: true });
  await rm(join(next, "bun.lock"), { force: true });
  await Bun.write(join(next, "package.json"), `${JSON.stringify(INSTANCE_PACKAGE, null, 2)}\n`);
  const bytes = [...client.files.values()].reduce((sum, { contents }) => sum + contents.size, 0);
  console.log(
    `built ${units.length} plugins, client ${client.files.size} files ${formatBytes(bytes)}, ${client.preloads.length} modulepreload`,
  );
}

export async function applyPlan(dir: string, plan: Plan): Promise<void> {
  const { next, previous, root } = instancePaths(dir);
  await recover(dir);
  try {
    await assemble(dir, plan);
    await mkdir(previous, { recursive: true });
    for (const name of SWAPPED) {
      if (existsSync(join(root, name))) await rename(join(root, name), join(previous, name));
      await rename(join(next, name), join(root, name));
    }
  } catch (error) {
    await recover(dir);
    throw error;
  } finally {
    await rm(next, { force: true, recursive: true });
  }
  await rm(previous, { force: true, recursive: true });
}
