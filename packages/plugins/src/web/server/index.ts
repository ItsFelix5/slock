import { readFile } from "node:fs/promises";
import type { HttpHandler, Setup } from "@slock/core";
import { jsonResponse } from "../../slack/server/api/jsonResponse";
import { route, routes } from "../../slack/server/api/router";
import { APP_DIR, type build, writeDist } from "./build";
import { buildPlugin } from "./buildPlugin";
import { createDevBuild } from "./devBuild";
import { channelPreloadLinks } from "./indexHtml";
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
  const devBuild = DEV ? await createDevBuild() : undefined;
  if (devBuild) ctx.onCleanup(devBuild.close);

  const serve: HttpHandler = async (c, next) => {
    if (c.req.method !== "GET" || c.url.pathname.startsWith("/api/")) return next();
    const { pathname } = c.url;
    const requestHeaders = c.req.headers;
    const unsafe = pathname.includes("..");
    if (pathname.startsWith("/plugins/")) {
      const file = operatorPluginFile(pathname);
      return file ? serveFile(file, pathname, requestHeaders) : undefined;
    }
    if (pathname.startsWith("/public/")) {
      return unsafe ? undefined : serveFile(`${APP_DIR}${pathname}`, pathname, requestHeaders);
    }
    if (pathname.startsWith("/assets/")) {
      if (unsafe) return;
      if (!DEV) return serveFile(`${APP_DIR}/dist${pathname}`, pathname, requestHeaders);
      const file = built?.files.get(pathname);
      return file && new Response(file.contents, { headers: { "content-type": file.contentType } });
    }
    const link = c.creds ? channelPreloadLinks(pathname) : undefined;
    if (DEV) {
      built = await devBuild?.get();
      if (!built) return;
      importMapHash = scriptHash(built.importMap);
      const headers: Record<string, string> = { "content-type": "text/html" };
      if (link) headers.link = link;
      return new Response(built.html(!!c.creds), { headers });
    }
    const name = c.creds ? "index.bootstrap.html" : "index.html";
    const res = await serveFile(`${APP_DIR}/dist/${name}`, "/", requestHeaders);
    if (res && link) res.headers.set("link", link);
    return res;
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
