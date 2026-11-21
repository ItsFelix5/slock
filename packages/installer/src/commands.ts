import { resolve } from "node:path";
import { applyPlan, instancePaths, recover } from "./apply";
import { buildPlugin } from "./buildPlugin";
import { confirmPlan, formatBytes, type Prompter } from "./confirm";
import { buildPlan, type Plan, sameContent } from "./plan";
import { type Candidate, openSession, resolveSpec, type Session } from "./sources";
import { type Command, parseTargets, type Spec } from "./spec";
import { type Staged, stage } from "./stage";
import { readUnits, type Unit } from "./units";

type Context = { command: Command; prompter: Prompter; dir: string };

async function candidatesOf(specs: Spec[], session: Session): Promise<Candidate[]> {
  const found = (
    await Promise.all(specs.map((spec) => resolveSpec(spec, process.cwd(), session)))
  ).flat();
  const byId = new Map<string, Candidate>();
  for (const candidate of found) {
    const { id } = candidate.manifest;
    const other = byId.get(id);
    if (other && other.from !== candidate.from)
      throw new Error(`${id} comes from both ${other.source} and ${candidate.source}`);
    byId.set(id, candidate);
  }
  return [...byId.values()];
}

function stageChanged(
  candidates: Candidate[],
  existing: Unit[],
  session: Session,
): Promise<Staged[]> {
  const previous = new Map(existing.map((unit) => [unit.manifest.id, unit]));
  return Promise.all(
    candidates.map((candidate) => {
      const unit = previous.get(candidate.manifest.id);
      return unit && sameContent(unit, candidate)
        ? { candidate, dependencies: unit.meta.dependencies, dir: unit.dir }
        : stage(candidate, session);
    }),
  );
}

async function run(
  { command, dir, prompter }: Context,
  makePlan: (existing: Unit[], session: Session) => Promise<Plan>,
): Promise<void> {
  await recover(dir);
  const session = await openSession();
  try {
    const plan = await makePlan(await readUnits(instancePaths(dir).plugins), session);
    if (!(await confirmPlan(plan, prompter, command.yes))) return;
    await applyPlan(dir, plan);
  } finally {
    await session.cleanup();
  }
}

function install(context: Context): Promise<void> {
  const { command } = context;
  if (command.targets.length === 0) throw new Error("install what? give an id, path or url");
  return run(context, async (existing, session) => {
    const candidates = await candidatesOf(parseTargets(command.targets, command.off), session);
    return buildPlan({
      command: "install",
      downloads: session.downloads,
      existing,
      slock: session.slock,
      staged: await stageChanged(candidates, existing, session),
    });
  });
}

function update(context: Context): Promise<void> {
  const ids = context.command.targets.flatMap((target) => target.split(","));
  return run(context, async (existing, session) => {
    const chosen =
      ids.length > 0 ? existing.filter(({ manifest }) => ids.includes(manifest.id)) : existing;
    const missing = ids.filter((id) => !chosen.some(({ manifest }) => manifest.id === id));
    if (missing.length > 0) throw new Error(`not installed: ${missing.join(", ")}`);
    const specs = chosen.flatMap(({ meta }) => parseTargets([meta.from], meta.off));
    const candidates = await candidatesOf(specs, session);
    return buildPlan({
      command: "update",
      downloads: session.downloads,
      existing,
      slock: session.slock,
      staged: await stageChanged(candidates, existing, session),
    });
  });
}

function uninstall(context: Context): Promise<void> {
  const { command } = context;
  const removeIds = command.targets.flatMap((target) => target.split(","));
  if (removeIds.length === 0) throw new Error("uninstall what? give plugin ids");
  return run(context, async (existing, session) =>
    buildPlan({
      command: "uninstall",
      downloads: [],
      existing,
      force: command.force,
      removeIds,
      slock: session.slock,
      staged: [],
    }),
  );
}

async function sizeOf(dir: string): Promise<number> {
  let total = 0;
  for await (const path of new Bun.Glob("**/*").scan({ cwd: dir, dot: true }))
    total += Bun.file(`${dir}/${path}`).size;
  return total;
}

async function list({ dir, prompter }: Context): Promise<void> {
  const units = await readUnits(instancePaths(dir).plugins);
  for (const { dir: unitDir, manifest, meta } of units) {
    const size = formatBytes(await sizeOf(unitDir));
    const flags = [meta.off ? "off" : "on", manifest.boot ? "boot" : ""].filter(Boolean).join(" ");
    prompter.print(
      [
        manifest.id.padEnd(22),
        meta.commit.padEnd(14),
        flags.padEnd(9),
        size.padEnd(10),
        meta.source,
      ].join(" "),
    );
  }
  if (units.length === 0) prompter.print("nothing installed");
}

async function build({ command }: Context): Promise<void> {
  const [entry, output] = command.targets;
  if (!(entry && output)) throw new Error("usage: bun plugin build <entry> <output.js>");
  await buildPlugin(entry, output);
}

const COMMANDS: Record<string, (context: Context) => Promise<void>> = {
  build,
  install,
  list,
  uninstall,
  update,
};

export function runCommand(command: Command, prompter: Prompter): Promise<void> {
  const handler = COMMANDS[command.name];
  if (!handler)
    throw new Error(`unknown command "${command.name}": install, uninstall, update, list, build`);
  return handler({ command, dir: resolve(command.dir ?? "instance"), prompter });
}
