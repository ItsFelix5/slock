import { halvesOf, type Unit } from "./units";

export function validateUnits(units: Unit[]): string[] {
  const errors: string[] = [];
  const owners = new Map<string, string>();
  for (const { manifest } of units) {
    for (const name of [manifest.id, ...(manifest.provides ?? [])]) {
      const owner = owners.get(name);
      if (owner && owner !== manifest.id)
        errors.push(`${manifest.id} and ${owner} both provide ${name}`);
      owners.set(name, manifest.id);
    }
  }
  const byId = new Map(units.map((unit) => [unit.manifest.id, unit]));
  for (const { manifest } of units) {
    for (const required of manifest.requires ?? []) {
      const provider = owners.get(required);
      const target = provider ? byId.get(provider) : undefined;
      if (!target) errors.push(`${manifest.id} requires ${required}, which is not installed`);
      else if (manifest.boot && !target.manifest.boot && halvesOf(target.dir).clientDir)
        errors.push(
          `boot plugin ${manifest.id} requires ${target.manifest.id}, which is not boot: mark ${target.manifest.id} boot or drop the require`,
        );
    }
  }
  const state = new Map<string, "open" | "done">();
  const visit = (id: string, trail: string[]): string | null => {
    if (state.get(id) === "done") return null;
    if (state.get(id) === "open") return [...trail, id].join(" > ");
    state.set(id, "open");
    for (const required of byId.get(id)?.manifest.requires ?? []) {
      const provider = owners.get(required);
      const found = provider && provider !== id ? visit(provider, [...trail, id]) : null;
      if (found) return found;
    }
    state.set(id, "done");
    return null;
  };
  for (const id of byId.keys()) {
    const cycle = visit(id, []);
    if (cycle) return [...errors, `requires cycle: ${cycle}`];
  }
  return errors;
}

export function requiredBy(units: Unit[], id: string): string[] {
  return units
    .filter(({ manifest }) => manifest.id !== id && manifest.requires?.includes(id))
    .map(({ manifest }) => manifest.id);
}
