import type { PluginDef } from "@slock/core";
import { halvesOf, type Unit } from "./units";

type ClientUnit = { unit: Unit; entry?: string };

function clientUnits(units: Unit[]): ClientUnit[] {
  return units.flatMap((unit) => {
    const { clientDir, clientEntry } = halvesOf(unit.dir);
    return clientDir || clientEntry ? [{ entry: clientEntry, unit }] : [];
  });
}

export function providedIds(units: Unit[]): Set<string> {
  return new Set(units.flatMap(({ manifest }) => [manifest.id, ...(manifest.provides ?? [])]));
}

export function definitionMeta(
  { manifest }: Unit,
  present: Set<string>,
): Omit<PluginDef, "setup" | "load"> {
  return { ...manifest, requires: manifest.requires?.filter((id) => present.has(id)) };
}

export function bootModule(units: Unit[]): string {
  const found = clientUnits(units);
  const present = providedIds(found.map(({ unit }) => unit));
  const statics: string[] = [];
  const defs: string[] = [];
  for (const [index, { entry, unit }] of found.entries()) {
    const meta = JSON.stringify({
      ...definitionMeta(unit, present),
      ...(unit.meta.off ? { defaultEnabled: false } : {}),
    });
    const path = JSON.stringify(entry);
    if (!entry) defs.push(`{ ...${meta}, setup: () => {} }`);
    else if (unit.manifest.boot) {
      statics.push(`import setup${index} from ${path};`);
      defs.push(`{ ...${meta}, setup: setup${index} }`);
    } else defs.push(`{ ...${meta}, load: () => import(${path}) }`);
  }
  return `import { boot } from "@slock/core/boot";\n${statics.join("\n")}\nboot([\n${defs.join(",\n")}\n]);\n`;
}
