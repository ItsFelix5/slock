import { readFile } from "node:fs/promises";
import type { HttpHandler, Setup } from "@slock/core";
import { jsonResponse } from "../../slack/server/api/jsonResponse";
import { route, routes } from "../../slack/server/api/router";
import { APP_DIR, build, writeDist } from "./build";
import { buildPlugin } from "./buildPlugin";
import { listPlugins, operatorPluginFile } from "./operatorPlugins";
import { serveFile } from "./staticFiles";

const DEV = Bun.argv.includes("--dev");
const IMPORT_MAP_TAG = /<script type="importmap">([\s\S]*?)<\/script>/;

type Built = Awaited<ReturnType<typeof build>>;

function scriptHash(content: string): string {
  return `'sha256-${new Bun.CryptoHasher("sha256").update(content).digest("base64")}'`;
}

async function builtImportMapHash(): Promise<string | undefined> {
  try {
    const html = await readFile(`${APP_DIR}/dist/index.html`, "utf8");
    const content = IMPORT_MAP_TAG.exec(html)?.[1];
    return content ? scriptHash(content) : undefined;
  } catch {}
}

const setup: Setup = async (ctx) => {
  let built: Built | undefined;
  let importMapHash = DEV ? undefined : await builtImportMapHash();

  const serve: HttpHandler = async (c, next) => {
    if (c.req.method !== "GET" || c.url.pathname.startsWith("/api/")) return next();
    const { pathname } = c.url;
    const encoding = c.req.headers.get("accept-encoding");
    const unsafe = pathname.includes("..");
    if (pathname.startsWith("/plugins/")) {
      const file = operatorPluginFile(pathname);
      return file ? new Response(Bun.file(file)) : undefined;
    }
    if (pathname.startsWith("/public/")) {
      return unsafe ? undefined : serveFile(`${APP_DIR}${pathname}`, pathname, encoding);
    }
    if (pathname.startsWith("/assets/")) {
      if (unsafe) return;
      if (!DEV) return serveFile(`${APP_DIR}/dist${pathname}`, pathname, encoding);
      const file = built?.files.get(pathname);
      return file && new Response(file.contents, { headers: { "content-type": file.contentType } });
    }
    if (DEV) {
      built = await build(false);
      importMapHash = scriptHash(built.importMap);
      return new Response(built.html(!!c.creds), { headers: { "content-type": "text/html" } });
    }
    const name = c.creds ? "index.bootstrap.html" : "index.html";
    return serveFile(`${APP_DIR}/dist/${name}`, "/", encoding);
  };

  ctx.add("http", serve, { order: -100 });
  ctx.add(
    "http",
    routes([route("GET", "plugins", async () => jsonResponse(await listPlugins(), null))]),
  );
  ctx.add("http.csp", () => ({
    "script-src": [...(importMapHash ? [importMapHash] : []), "blob:"],
  }));
  ctx.add("cli", { flag: "--build", run: () => writeDist() });
  ctx.add("cli", {
    flag: "--build-plugin",
    run: ([entry, output]) => {
      if (!(entry && output)) throw new Error("usage: --build-plugin <entry> <output.js>");
      return buildPlugin(entry, output);
    },
  });
};

export default setup;
