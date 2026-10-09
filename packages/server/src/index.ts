import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { type Credentials, parseCredentials } from "./auth";
import { compressResponse, errorMessage } from "./http/compressedResponse";
import { renderIndexHtml } from "./indexHtml";
import { bootstrapRoutes } from "./operations/bootstrap.ts";
import {
  handleClientDisconnect,
  handleClientMessage,
  handleClientOpen,
  statusMessage,
} from "./realtime";
import { resolveBuildAssets } from "./resolveBuildAssets";
import { accountRoutes } from "./routes/account/account.ts";
import { activityRoutes } from "./routes/account/activity.ts";
import { hackclubAuthRoutes } from "./routes/account/hackclubAuth.ts";
import { preferenceRoutes } from "./routes/account/preferences.ts";
import { sessionRoutes } from "./routes/account/session.ts";
import { userStatusRoutes } from "./routes/account/userStatus.ts";
import { canvasCommentRoutes } from "./routes/channels/canvasComments.ts";
import { canvasRoutes } from "./routes/channels/canvases.ts";
import { channelDirectoryRoutes } from "./routes/channels/channelDirectory.ts";
import { channelRoutes } from "./routes/channels/channels.ts";
import { sectionRoutes } from "./routes/channels/sections.ts";
import { conversationViewRoutes } from "./routes/messages/conversationView.ts";
import { draftRoutes } from "./routes/messages/drafts.ts";
import { fileRoutes } from "./routes/messages/files.ts";
import { messageActionRoutes } from "./routes/messages/messageActions.ts";
import { messageRoutes } from "./routes/messages/messages.ts";
import { threadRoutes } from "./routes/messages/threads.ts";
import { matchRoute, type Route } from "./routes/router";
import { appRoutes } from "./routes/workspace/apps.ts";
import { assetRoutes } from "./routes/workspace/assets.ts";
import { commandRoutes } from "./routes/workspace/commands.ts";
import { searchRoutes } from "./routes/workspace/search.ts";
import { usergroupRoutes } from "./routes/workspace/usergroups.ts";
import { solidPlugin } from "./solidPlugin";
import { serveFile, writePrecompressed } from "./staticFiles";

const APP_DIR = resolve(import.meta.dir, "../../app");
const DEV = Bun.argv.includes("--dev");
const INDEX_VARIANTS = [
  ["index.html", false],
  ["index.bootstrap.html", true],
] as const;

let files: Map<string, { contents: Blob; contentType: string }>;

type IndexHtml = (preloadBootstrap: boolean) => string;

async function build(minify?: boolean): Promise<{ html: IndexHtml; outputs: Bun.BuildArtifact[] }> {
  const result = await Bun.build({
    entrypoints: [`${APP_DIR}/src/index.tsx`],
    external: ["/public/*"],
    naming: {
      asset: "assets/[name]-[hash].[ext]",
      chunk: "assets/[name]-[hash].[ext]",
      entry: "assets/[name]-[hash].[ext]",
    },
    minify: !!minify,
    plugins: [solidPlugin],
    sourcemap: "linked",
    splitting: true,
    target: "browser",
  });

  for (const log of result.logs)
    if (!log.message.includes("pseudo-element 'highlight'")) console.error(log);
  if (!result.success) throw new Error("Build failed");

  files = new Map();
  const toUrl = (path: string) => `/${path.startsWith("./") ? path.slice(2) : path}`;
  for (const output of result.outputs)
    files.set(toUrl(output.path), { contents: output, contentType: output.type });

  const { entryPath, entryCssPaths, preloadPaths, staleCssPaths } = await resolveBuildAssets(
    result.outputs,
    toUrl,
  );
  return {
    html: (preloadBootstrap) =>
      renderIndexHtml(entryPath, entryCssPaths, preloadPaths, preloadBootstrap),
    outputs: result.outputs.filter((output) => !staleCssPaths.includes(toUrl(output.path))),
  };
}

if (Bun.argv.includes("--build")) {
  await rm(`${APP_DIR}/dist`, { force: true, recursive: true });
  const { html, outputs } = await build(true);
  for (const [name, preloadBootstrap] of INDEX_VARIANTS) {
    const path = `${APP_DIR}/dist/${name}`;
    const contents = new Blob([html(preloadBootstrap)], { type: "text/html" });
    await Bun.write(path, contents);
    await writePrecompressed(path, contents);
  }
  for (const output of outputs) {
    const path = `${APP_DIR}/dist/${output.path.startsWith("./") ? output.path.slice(2) : output.path}`;
    await Bun.write(path, output);
    await writePrecompressed(path, output);
  }
  process.exit();
}

const ROUTES: Route[] = [
  ...messageActionRoutes,
  ...messageRoutes,
  ...threadRoutes,
  ...conversationViewRoutes,
  ...canvasRoutes,
  ...canvasCommentRoutes,
  ...channelDirectoryRoutes,
  ...channelRoutes,
  ...sectionRoutes,
  ...draftRoutes,
  ...fileRoutes,
  ...accountRoutes,
  ...usergroupRoutes,
  ...appRoutes,
  ...searchRoutes,
  ...preferenceRoutes,
  ...activityRoutes,
  ...commandRoutes,
  ...userStatusRoutes,
  ...bootstrapRoutes,
  ...assetRoutes,
  ...sessionRoutes,
  ...hackclubAuthRoutes,
];

function credsFromCookie(cookieHeader: string | null): Credentials | null {
  for (const part of cookieHeader?.split(";") ?? []) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== "slock_creds") continue;
    try {
      const parsed = parseCredentials(JSON.parse(decodeURIComponent(part.slice(eq + 1).trim())));
      return parsed.ok ? parsed.credentials : null;
    } catch {}
  }
  return null;
}

Bun.serve<{ creds: Credentials | null }>({
  async fetch(req, server) {
    try {
      const url = new URL(req.url);
      const isAsset = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/public/");
      const creds = isAsset ? null : credsFromCookie(req.headers.get("cookie"));

      if (url.pathname === "/ws") {
        if (server.upgrade(req, { data: { creds } })) return;
        return new Response("upgrade failed", { status: 400 });
      }

      let res: Response | undefined;
      if (url.pathname.startsWith("/api/")) {
        const matched = matchRoute(ROUTES, req.method, url.pathname.slice("/api".length));
        if (matched) {
          res = await matched.route.handler({
            acceptEncoding: req.headers.get("accept-encoding"),
            body: {
              buffer: async () => new Uint8Array(await req.arrayBuffer()),
              json: async () => JSON.parse(await req.text()),
            },
            creds,
            params: matched.params,
            searchParams: url.searchParams,
            range: req.headers.get("range"),
          });
        }
      } else if (req.method === "GET") {
        const acceptEncoding = req.headers.get("accept-encoding");
        const unsafe = url.pathname.includes("..");
        if (url.pathname.startsWith("/public/")) {
          if (!unsafe)
            res = await serveFile(`${APP_DIR}${url.pathname}`, url.pathname, acceptEncoding);
        } else if (url.pathname.startsWith("/assets/")) {
          if (DEV) {
            const file = unsafe ? undefined : files?.get(url.pathname);
            if (file)
              res = new Response(file.contents, { headers: { "content-type": file.contentType } });
          } else if (!unsafe) {
            res = await serveFile(`${APP_DIR}/dist${url.pathname}`, url.pathname, acceptEncoding);
          }
        } else if (DEV) {
          res = new Response((await build()).html(!!creds), {
            headers: { "content-type": "text/html" },
          });
        } else {
          res = await serveFile(
            `${APP_DIR}/dist/${creds ? "index.bootstrap.html" : "index.html"}`,
            "/",
            acceptEncoding,
          );
        }
      }

      if (!res) return new Response("not found", { status: 404 });
      res.headers.set(
        "content-security-policy",
        "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob: https://slack-imgs.com; media-src 'self' https://slack-imgs.com; font-src 'self' data:; connect-src 'self'; frame-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
      );
      res.headers.set("x-content-type-options", "nosniff");
      return compressResponse(res, req.headers.get("accept-encoding"));
    } catch (error) {
      return Response.json(
        { error: errorMessage(error, "Server request failed") },
        { status: 500 },
      );
    }
  },
  hostname: "0.0.0.0",
  port: 5175,
  websocket: {
    close(ws) {
      handleClientDisconnect(ws);
    },
    message(ws, raw) {
      handleClientMessage(String(raw), ws);
    },
    open(ws) {
      ws.send(statusMessage(false));
      handleClientOpen(ws, ws.data.creds);
    },
  },
});

console.log(`(${DEV ? "dev" : "production"}): http://localhost:${5175}`);
