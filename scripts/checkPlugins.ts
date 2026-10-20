import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PLUGINS_DIR = join(import.meta.dir, "../packages/plugins/src");
const SOURCE = /\.(ts|tsx)$/;
const IMPORT = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']*)["']/g;
const SERVICE_USE = /(?:\bservice|ctx\.get|ctx\.maybe)\(\s*["']([^"']+)["']/g;
const PUBLIC_NAMES = new Set(["api", "contract"]);
const HANDLER_TYPES = /(?:types:|gatewayHandler\(|_EVENTS\s*=)\s*\[([^\]]*)\]/g;
const BANNED: [RegExp, string][] = [
  [/\bcreateResource\b/, "createResource (use a query)"],
  [/queryKey:\s*\[/, "literal query key (use defineKey)"],
  [/^(?:export )?const .*= createRoot\(/m, "module level createRoot (create it in setup)"],
];
const LIBRARY_PACKAGES = ["core", "ui", "blockkit", "slack", "types"];
const GATEWAY_EVENTS_FILE = join(import.meta.dir, "../packages/types/src/gatewayEvents.ts");
const INTERNAL_EVENTS = new Set(["_status"]);
const fix = Bun.argv.includes("--fix");

type Manifest = { id: string; requires?: string[]; provides?: string[] };

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return SOURCE.test(entry.name) ? [path] : [];
  });
}

const ids = readdirSync(PLUGINS_DIR).filter((id) =>
  existsSync(join(PLUGINS_DIR, id, "plugin.json")),
);
const manifests = new Map<string, Manifest>(
  ids.map((id) => [id, JSON.parse(readFileSync(join(PLUGINS_DIR, id, "plugin.json"), "utf8"))]),
);
const providers = new Map<string, string>();
for (const [id, manifest] of manifests) {
  providers.set(id, id);
  for (const provided of manifest.provides ?? [])
    if (!providers.has(provided)) providers.set(provided, id);
}

const errors: string[] = [];
const handledEvents = new Set<string>();
let overlong = 0;
let shortFiles = 0;

for (const [id, manifest] of manifests) {
  if (manifest.id !== id) errors.push(`${id}: plugin.json id is ${manifest.id}`);
  const requires = new Set(manifest.requires ?? []);
  for (const required of requires) {
    if (!providers.has(required)) errors.push(`${id}: requires unknown plugin ${required}`);
  }
  const used = new Set<string>();
  for (const file of walk(join(PLUGINS_DIR, id))) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n").length - 1;
    if (lines > 300) overlong++;
    if (lines < 15) shortFiles++;
    for (const match of text.matchAll(HANDLER_TYPES)) {
      for (const name of match[1].matchAll(/"([a-z_]+)"/g)) handledEvents.add(name[1]);
    }
    for (const [pattern, message] of BANNED) {
      if (pattern.test(text)) errors.push(`${file.slice(PLUGINS_DIR.length + 1)}: ${message}`);
    }
    for (const match of text.matchAll(SERVICE_USE)) {
      const [owner] = match[1].split(".");
      if (owner !== id) used.add(owner);
    }
    for (const match of text.matchAll(IMPORT)) {
      const target = join(file, "..", match[1])
        .slice(PLUGINS_DIR.length + 1)
        .split("/");
      const [targetId] = target;
      if (!(targetId && manifests.has(targetId)) || targetId === id) continue;
      if (target.slice(1).some((segment) => PUBLIC_NAMES.has(segment))) continue;
      errors.push(`${file.slice(PLUGINS_DIR.length + 1)} imports ${target.join("/")}`);
    }
  }
  const missing = [...used].filter((owner) => {
    const provider = providers.get(owner);
    return (
      provider &&
      provider !== id &&
      !manifest.provides?.includes(owner) &&
      !requires.has(owner) &&
      !requires.has(provider)
    );
  });
  if (missing.length > 0) {
    if (fix) {
      manifest.requires = [...new Set([...requires, ...missing])].sort();
      writeFileSync(join(PLUGINS_DIR, id, "plugin.json"), `${JSON.stringify(manifest)}\n`);
    } else errors.push(`${id}: uses ${missing.join(", ")} without requiring it`);
  }
}

for (const pkg of LIBRARY_PACKAGES) {
  const root = join(import.meta.dir, "../packages", pkg, "src");
  if (!existsSync(root)) continue;
  for (const file of walk(root)) {
    if (/@slock\/plugins|plugins\/src/.test(readFileSync(file, "utf8"))) {
      errors.push(`${pkg} imports plugins: ${file.slice(root.length + 1)}`);
    }
  }
}

const gatewaySource = readFileSync(GATEWAY_EVENTS_FILE, "utf8");
for (const match of gatewaySource.matchAll(/type: ((?:"[a-z_]+"(?:\s*\|\s*)?)+)/g)) {
  for (const name of match[1].matchAll(/"([a-z_]+)"/g)) {
    if (!(handledEvents.has(name[1]) || INTERNAL_EVENTS.has(name[1]))) {
      errors.push(`gateway event ${name[1]} has no handler`);
    }
  }
}

function sideProviders(side: "client" | "server"): Map<string, string> {
  const result = new Map<string, string>();
  const present = [...manifests].filter(([id]) => existsSync(join(PLUGINS_DIR, id, side)));
  for (const [id, manifest] of present) {
    result.set(id, id);
    for (const provided of manifest.provides ?? [])
      if (!result.has(provided)) result.set(provided, id);
  }
  for (const [id] of present) result.set(id, id);
  return result;
}

function hasCycle(side: "client" | "server"): string | undefined {
  const sideMap = sideProviders(side);
  const state = new Map<string, "open" | "done">();
  const visit = (id: string, trail: string[]): string | undefined => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "open") return [...trail, id].join(" > ");
    state.set(id, "open");
    for (const required of manifests.get(id)?.requires ?? []) {
      const provider = sideMap.get(required);
      if (provider && provider !== id) {
        const found = visit(provider, [...trail, id]);
        if (found) return found;
      }
    }
    state.set(id, "done");
  };
  for (const id of new Set(sideMap.values())) {
    const found = visit(id, []);
    if (found) return `${side}: ${found}`;
  }
}

for (const side of ["client", "server"] as const) {
  const cycle = hasCycle(side);
  if (cycle) errors.push(`requires cycle: ${cycle}`);
}

console.log(
  `plugins: ${manifests.size}, files over 300 lines: ${overlong}, under 15: ${shortFiles}`,
);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
