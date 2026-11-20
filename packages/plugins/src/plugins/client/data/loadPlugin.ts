import type { Manifest, PluginDef, Setup } from "@slock/core";
import { isRecord } from "@slock/core";

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export type PluginModule = { default?: unknown; manifest?: unknown; css?: unknown };

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readManifest(mod: PluginModule): Manifest {
  const { manifest } = mod;
  if (!(isRecord(manifest) && typeof manifest.id === "string" && ID_PATTERN.test(manifest.id))) {
    throw new Error("The plugin must export a manifest with a lowercase id.");
  }
  return {
    id: manifest.id,
    name: typeof manifest.name === "string" ? manifest.name : manifest.id,
    provides: stringList(manifest.provides),
    requires: stringList(manifest.requires),
  };
}

const isSetup = (value: unknown): value is Setup => typeof value === "function";

export function setupOf(mod: PluginModule): Setup {
  if (!isSetup(mod.default)) throw new Error("The plugin must export a setup function.");
  return withStyles(mod.css, mod.default);
}

function withStyles(css: unknown, setup: Setup): Setup {
  if (typeof css !== "string") return setup;
  return async (ctx) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    ctx.onCleanup(() => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
    });
    await setup(ctx);
  };
}

export async function definitionFromSource(code: string): Promise<PluginDef> {
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  try {
    const mod: PluginModule = await import(url);
    return { ...readManifest(mod), setup: setupOf(mod) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
