import type { HttpHandler, Setup } from "@slock/core";
import type { ClientBuild } from "@slock/installer/dev";
import { jsonResponse } from "@slock/plugins/slack/server/api/jsonResponse";
import { route, routes } from "@slock/plugins/slack/server/api/router";
import { preloadLinkHeader } from "./indexHtml";
import { serveFile } from "./staticFiles";

const IMPORT_MAP_TAG = /<script type="importmap">([\s\S]*?)<\/script>/;

function scriptHash(content: string): string {
  return `'sha256-${new Bun.CryptoHasher("sha256").update(content).digest("base64")}'`;
}

async function builtImportMapHash(clientDir: string): Promise<string | undefined> {
  const file = Bun.file(`${clientDir}/index.html`);
  if (!(await file.exists())) return;
  const content = IMPORT_MAP_TAG.exec(await file.text())?.[1];
  return content ? scriptHash(content) : undefined;
}

const setup: Setup = async (ctx) => {
  const preloads = ctx.use("web.preload");
  const instance = ctx.get("instance");
  const dev = instance.dev
    ? await (await import("@slock/installer/dev")).createDevBuild()
    : undefined;
  if (dev) ctx.onCleanup(dev.close);
  const staticDir = dev ? dev.publicDir : `${instance.clientDir}/public`;
  let built: ClientBuild | undefined;
  let importMapHash = instance.clientDir ? await builtImportMapHash(instance.clientDir) : undefined;

  const serve: HttpHandler = async (c, next) => {
    if (c.req.method !== "GET" || c.url.pathname.startsWith("/api/")) return next();
    const { pathname } = c.url;
    const requestHeaders = c.req.headers;
    if (pathname.includes("..")) return;
    if (pathname.startsWith("/public/"))
      return serveFile(`${staticDir}${pathname.slice("/public".length)}`, pathname, requestHeaders);
    if (pathname.startsWith("/assets/")) {
      if (!dev) return serveFile(`${instance.clientDir}${pathname}`, pathname, requestHeaders);
      const file = built?.files.get(pathname);
      return file && new Response(file.contents, { headers: { "content-type": file.contentType } });
    }
    const link = c.creds
      ? preloadLinkHeader(preloads().flatMap((hrefs) => hrefs(pathname)))
      : undefined;
    if (dev) {
      built = await dev.get();
      importMapHash = scriptHash(built.importMap);
      const headers: Record<string, string> = { "content-type": "text/html" };
      if (link) headers.link = link;
      return new Response(built.html(!!c.creds), { headers });
    }
    const name = c.creds ? "index.bootstrap.html" : "index.html";
    const res = await serveFile(`${instance.clientDir}/${name}`, "/", requestHeaders);
    if (res && link) res.headers.set("link", link);
    return res;
  };

  ctx.add("http", serve, { order: -100 });
  ctx.add(
    "http",
    routes([
      route("GET", "plugins", () =>
        jsonResponse({
          serverOnly: instance.units
            .filter(({ client, hidden, server }) => server && !client && !hidden)
            .map(({ id, name }) => ({ id, name })),
        }),
      ),
    ]),
  );
  ctx.add("http.csp", () => ({
    "script-src": [...(importMapHash ? [importMapHash] : []), "blob:"],
  }));
};

export default setup;
