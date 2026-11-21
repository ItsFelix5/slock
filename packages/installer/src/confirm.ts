import { hasChanges, type Plan, serverHalves } from "./plan";

export type Prompter = {
  interactive: boolean;
  print(line: string): void;
  ask(question: string): Promise<string>;
};

const KIND_WIDTH = 13;
const YES = /^y(es)?$/i;
const UNITS = ["B", "KB", "MB", "GB"];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`;
}

const row = (kind: string, text: string) => `  ${kind.padEnd(KIND_WIDTH)}${text}`;
const names = (ids: string[]) => ids.join(", ");

export function describePlan(plan: Plan): string[] {
  const lines = [`slock ${plan.command}`, ""];
  for (const { bytes, commit, label } of plan.downloads)
    lines.push(row("download", `${label} @ ${commit}  (tarball, ${formatBytes(bytes)})`));
  const withDependencies = [...plan.adds, ...plan.replaces.map(({ staged }) => staged)].filter(
    ({ dependencies }) => Object.keys(dependencies).length > 0,
  );
  for (const { candidate, dependencies } of withDependencies) {
    const list = Object.entries(dependencies).map(([name, range]) => `${name}@${range}`);
    lines.push(
      row("dependencies", `${candidate.manifest.id}: bun install --production --ignore-scripts`),
      row("", `${list.join(", ")}  (lifecycle scripts are NOT run)`),
    );
  }
  if (lines.length > 2) lines.push("");
  for (const { candidate } of plan.adds)
    lines.push(
      row(
        "add",
        `${candidate.manifest.id}  from ${candidate.source} @ ${candidate.commit}${requires(candidate.manifest.requires)}`,
      ),
    );
  for (const { previous, staged } of plan.replaces)
    lines.push(
      row(
        "replace",
        `${previous.manifest.id}  ${previous.meta.commit} -> ${staged.candidate.commit}  from ${staged.candidate.source}`,
      ),
    );
  for (const { staged } of plan.flagChanges)
    lines.push(
      row(
        "default",
        `${staged.candidate.manifest.id}  ${staged.candidate.off ? "off" : "on"} for users`,
      ),
    );
  for (const { requiredBy, unit } of plan.removes)
    lines.push(
      row(
        "remove",
        `${unit.manifest.id}${requiredBy.length > 0 ? `  still required by ${names(requiredBy)}` : ""}`,
      ),
    );
  const changed = [...plan.adds, ...plan.replaces.map(({ staged }) => staged)];
  const running = serverHalves(
    changed.map(({ candidate, dir }) => ({ dir, manifest: candidate.manifest })),
  );
  lines.push("");
  if (running.length > 0)
    lines.push(row("run code", `server halves run inside the server process: ${names(running)}`));
  if (changed.length > 0)
    lines.push(
      row("write", `plugins/{${names(changed.map(({ candidate }) => candidate.manifest.id))}}`),
    );
  if (plan.removes.length > 0)
    lines.push(
      row("delete", `plugins/{${names(plan.removes.map(({ unit }) => unit.manifest.id))}}`),
    );
  lines.push(row("rebuild", "server.js, client/"));
  const off = [...plan.adds, ...plan.replaces.map(({ staged }) => staged)]
    .filter(({ candidate }) => candidate.off)
    .map(({ candidate }) => candidate.manifest.id);
  if (off.length > 0) lines.push("", row("default off", `for users: ${names(off)}`));
  for (const warning of plan.warnings) lines.push(row("warning", warning));
  return lines;
}

const requires = (list: readonly string[] = []) =>
  list.length > 0 ? `  requires: ${list.join(", ")}` : "";

export async function confirmPlan(plan: Plan, prompter: Prompter, yes: boolean): Promise<boolean> {
  if (!hasChanges(plan)) {
    prompter.print(`slock ${plan.command}: nothing to change`);
    return false;
  }
  for (const line of describePlan(plan)) prompter.print(line);
  if (yes) return true;
  if (!prompter.interactive) throw new Error("not a terminal: pass --yes to run without asking");
  const answer = await prompter.ask("\nProceed? [y/N]");
  return YES.test(answer.trim());
}
