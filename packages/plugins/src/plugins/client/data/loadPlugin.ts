import type { Manifest, PluginDef, Setup } from "@slock/core";
import { readManifest } from "@slock/core";

type PluginModule = { default?: unknown; manifest?: unknown; css?: unknown };

function manifestOf(mod: PluginModule): Manifest {
  const manifest = readManifest(mod.manifest, "The plugin manifest");
  return { ...manifest, name: manifest.name ?? manifest.id };
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
    return { ...manifestOf(mod), setup: setupOf(mod) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
