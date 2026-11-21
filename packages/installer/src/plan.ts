import type { Download } from "./github";
import type { Candidate } from "./sources";
import type { Staged } from "./stage";
import { halvesOf, type Unit } from "./units";
import { requiredBy, validateUnits } from "./validate";

export type Plan = {
  command: "install" | "update" | "uninstall";
  downloads: Download[];
  slock: string;
  adds: Staged[];
  replaces: { staged: Staged; previous: Unit }[];
  flagChanges: { staged: Staged; previous: Unit }[];
  unchanged: string[];
  removes: { unit: Unit; requiredBy: string[] }[];
  warnings: string[];
  result: Unit[];
};

const REMOTE_SOURCE = /^https?:|github/;
const UNSTABLE_COMMIT = /\+dirty$|^local$/;

export function sameContent(previous: Unit, candidate: Candidate): boolean {
  return (
    previous.meta.commit === candidate.commit &&
    previous.meta.from === candidate.from &&
    !UNSTABLE_COMMIT.test(candidate.commit)
  );
}

function unitOf({ candidate, dependencies, dir }: Staged, slock: string): Unit {
  return {
    dir,
    manifest: candidate.manifest,
    meta: {
      commit: candidate.commit,
      dependencies,
      from: candidate.from,
      off: candidate.off,
      slock,
      source: candidate.source,
    },
  };
}

type PlanInput = {
  command: Plan["command"];
  existing: Unit[];
  staged: Staged[];
  removeIds?: string[];
  force?: boolean;
  downloads: Download[];
  slock: string;
};

export function buildPlan(input: PlanInput): Plan {
  const { existing, slock, staged } = input;
  const previousById = new Map(existing.map((unit) => [unit.manifest.id, unit]));
  const plan: Plan = {
    adds: [],
    command: input.command,
    downloads: input.downloads,
    flagChanges: [],
    removes: [],
    replaces: [],
    result: [],
    slock,
    unchanged: [],
    warnings: [],
  };
  const result = new Map(previousById);
  for (const item of staged) {
    const { id } = item.candidate.manifest;
    const previous = previousById.get(id);
    if (!previous) plan.adds.push(item);
    else if (!sameContent(previous, item.candidate)) plan.replaces.push({ previous, staged: item });
    else if (previous.meta.off === item.candidate.off) plan.unchanged.push(id);
    else plan.flagChanges.push({ previous, staged: item });
    const kept = previous && sameContent(previous, item.candidate);
    result.set(
      id,
      kept
        ? { ...previous, meta: { ...previous.meta, off: item.candidate.off } }
        : unitOf(item, slock),
    );
  }
  for (const id of input.removeIds ?? []) {
    const unit = previousById.get(id);
    if (!unit) throw new Error(`${id} is not installed`);
    const users = requiredBy(existing, id).filter(
      (user) => !(input.removeIds ?? []).includes(user),
    );
    if (users.length > 0 && !input.force)
      throw new Error(`${id} is required by ${users.join(", ")} (--force removes it anyway)`);
    plan.removes.push({ requiredBy: users, unit });
    result.delete(id);
  }
  plan.result = [...result.values()].sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  if (!input.force) {
    const errors = validateUnits(plan.result);
    if (errors.length > 0) throw new Error(errors.join("\n"));
  }
  const dirty = staged.filter(({ candidate }) => UNSTABLE_COMMIT.test(candidate.commit));
  if (dirty.length > 0)
    plan.warnings.push(
      `${summarize(dirty.map(({ candidate }) => candidate.manifest.id))} built from a working tree with local changes`,
    );
  const foreign = staged.filter(
    ({ candidate }) => candidate.commit !== slock && REMOTE_SOURCE.test(candidate.source),
  );
  if (foreign.length > 0)
    plan.warnings.push(
      `${summarize(foreign.map(({ candidate }) => candidate.manifest.id))} not built against slock ${slock}`,
    );
  return plan;
}

const SHOWN_IDS = 3;

function summarize(ids: string[]): string {
  if (ids.length <= SHOWN_IDS) return ids.join(", ");
  return `${ids.slice(0, SHOWN_IDS).join(", ")} and ${ids.length - SHOWN_IDS} more`;
}

export const serverHalves = (units: Pick<Unit, "dir" | "manifest">[]) =>
  units.filter(({ dir }) => halvesOf(dir).serverEntry).map(({ manifest }) => manifest.id);

export const hasChanges = (plan: Plan) =>
  plan.adds.length + plan.replaces.length + plan.flagChanges.length + plan.removes.length > 0;
