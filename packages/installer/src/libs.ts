import type { BunPlugin } from "bun";
import { runBuildResult } from "./outputs";
import { RESOLVE_FROM } from "./paths";
import { solidPlugin } from "./solid";
import { virtualModule } from "./virtual";

const LIB_SLUGS: Record<string, string> = {
  "@slock/blockkit": "lib-blockkit",
  "@slock/core": "lib-core",
  "@slock/core/boot": "lib-core-boot",
  "@slock/core/services": "lib-core-services",
  "@slock/core/solid": "lib-core-solid",
  "@slock/resource": "lib-resource",
  "@slock/resource/solid": "lib-resource-solid",
  "@slock/slack": "lib-slack",
  "@slock/slack/client": "lib-slack-client",
  "@slock/ui": "lib-ui",
  "@slock/ui/editor/QuillEditor": "lib-ui-quill-editor",
  "@slock/ui/editor/inlineFormats": "lib-ui-inline-formats",
  "@slock/ui/editor/markdownAutoformat": "lib-ui-markdown-autoformat",
  "@slock/ui/editor/quill": "lib-ui-quill",
  "@slock/ui/editor/quillText": "lib-ui-quill-text",
  "@slock/ui/linkClick": "lib-ui-link-click",
  "@slock/ui/tag/tagColors": "lib-ui-tag-colors",
  "@solidjs/web": "lib-solidjs-web",
  "quill/blots/block": "lib-quill-block",
  "quill/blots/inline": "lib-quill-inline",
  "quill/formats/code": "lib-quill-code",
  "solid-js": "lib-solid-js",
};

const PINNED_RUNTIMES = new Set(["solid-js", "@solidjs/web"]);
const PROBE_PREFIX = "probe-";
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const ANY_FILE = /.*/;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const libSpecifiers = Object.keys(LIB_SLUGS);
export const LIBS_ID = "slock-libs";

function libTarget(specifier: string): string {
  if (PINNED_RUNTIMES.has(specifier)) return specifier;
  return Bun.resolveSync(specifier, RESOLVE_FROM);
}

const scanners = {
  js: new Bun.Transpiler({ loader: "js" }),
  ts: new Bun.Transpiler({ loader: "ts" }),
  tsx: new Bun.Transpiler({ loader: "tsx" }),
};
const EXTENSION = /\.([jt]sx?)$/;

async function hasDefault(specifier: string): Promise<boolean> {
  if (PINNED_RUNTIMES.has(specifier)) return false;
  const target = libTarget(specifier);
  const kind = target.match(EXTENSION)?.[1];
  const scanner =
    kind === "tsx" || kind === "jsx" ? scanners.tsx : kind === "ts" ? scanners.ts : scanners.js;
  return scanner.scan(await Bun.file(target).text()).exports.includes("default");
}

export function libsModule(): string {
  const specifiers = libSpecifiers.map((specifier, index) => ({
    index,
    specifier: JSON.stringify(specifier),
    target: JSON.stringify(libTarget(specifier)),
  }));
  const imports = specifiers.map(({ index, target }) => `import * as lib${index} from ${target};`);
  const entries = specifiers.map(({ index, specifier }) => `  ${specifier}: lib${index},`);
  const styles = `import ${JSON.stringify(libTarget("@slock/ui/global.css"))};`;
  return `${styles}\n${imports.join("\n")}\nexport const libs = {\n${entries.join("\n")}\n};\n`;
}

export type LibExports = Record<string, string[]>;

export async function probeLibExports(): Promise<LibExports> {
  const probes = libSpecifiers.map((specifier) => ({
    id: `${PROBE_PREFIX}${LIB_SLUGS[specifier]}`,
    specifier,
  }));
  const plugins = probes.map(({ id, specifier }) =>
    virtualModule(id, () => `export * from ${JSON.stringify(libTarget(specifier))};`),
  );
  const result = await runBuildResult({
    entrypoints: probes.map(({ id }) => id),
    external: ["/public/*"],
    metafile: true,
    naming: { entry: "[name].[ext]" },
    plugins: [solidPlugin, ...plugins],
    splitting: true,
    target: "browser",
  });
  const exports: LibExports = {};
  for (const [path, output] of Object.entries(result.metafile?.outputs ?? {})) {
    const slug = path.split("/").pop()?.replace(".js", "")?.slice(PROBE_PREFIX.length);
    const specifier = libSpecifiers.find((candidate) => LIB_SLUGS[candidate] === slug);
    if (specifier) exports[specifier] = output.exports.filter((name) => IDENTIFIER.test(name));
  }
  for (const specifier of libSpecifiers) {
    if (await hasDefault(specifier))
      exports[specifier] = [...(exports[specifier] ?? []), "default"];
  }
  return exports;
}

function shimSource(specifier: string, names: string[], libsUrl: string): string {
  const named = names.filter((name) => name !== "default");
  const lines = [
    `import { libs as __libs } from ${JSON.stringify(libsUrl)};`,
    `const __lib = __libs[${JSON.stringify(specifier)}];`,
  ];
  if (named.length > 0) lines.push(`export const { ${named.join(", ")} } = __lib;`);
  if (names.includes("default")) lines.push("export default __lib.default;");
  return `${lines.join("\n")}\n`;
}

export function libShims(exports: LibExports, libsUrl: string): BunPlugin {
  const filter = new RegExp(`^(${libSpecifiers.map(escapeRegExp).join("|")})$`);
  return {
    name: "lib-shims",
    setup(build) {
      build.onResolve({ filter }, ({ path }) => ({ namespace: "lib-shim", path }));
      build.onLoad({ filter: ANY_FILE, namespace: "lib-shim" }, ({ path }) => ({
        contents: shimSource(path, exports[path] ?? [], libsUrl),
        loader: "js",
      }));
    },
  };
}

export function libStubs(
  exports: LibExports,
  libsUrl: string,
): { specifier: string; url: string; code: string }[] {
  return libSpecifiers.map((specifier) => {
    const code = shimSource(specifier, exports[specifier] ?? [], libsUrl);
    const hash = Bun.hash(code).toString(36);
    return { code, specifier, url: `/assets/${LIB_SLUGS[specifier]}-${hash}.js` };
  });
}
