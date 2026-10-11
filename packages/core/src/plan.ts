import type { PluginDef } from "./types";

export type PlanInput = {
  defs: Map<string, PluginDef>;
  failed: Map<string, string>;
  isEnabled: (id: string) => boolean;
  resolveId: (id: string) => string | undefined;
};

export function planStart({ defs, failed, isEnabled, resolveId }: PlanInput) {
  const order: string[] = [];
  const blocked = new Map<string, string>();
  const visiting = new Set<string>();
  const settled = new Map<string, boolean>();

  function visit(id: string): boolean {
    const known = settled.get(id);
    if (known !== undefined) return known;
    const def = defs.get(id);
    if (!(def && isEnabled(id))) return false;
    if (failed.has(id)) return false;
    if (visiting.has(id)) {
      blocked.set(id, "dependency cycle");
      return false;
    }
    visiting.add(id);
    let ok = true;
    for (const name of def.requires ?? []) {
      const required = resolveId(name);
      if (!required) {
        blocked.set(id, `needs ${name}, which is not installed`);
        ok = false;
      } else if (!visit(required)) {
        if (!blocked.has(id)) blocked.set(id, `needs ${required}`);
        ok = false;
      }
    }
    visiting.delete(id);
    settled.set(id, ok);
    if (ok) order.push(id);
    return ok;
  }

  for (const id of defs.keys()) visit(id);
  return { blocked, order };
}
