import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import { renderIndexHtml } from "./indexHtml";
import { resolveBuildAssets } from "./resolveBuildAssets";
import { solidPlugin } from "./solidPlugin";
import { bootstrapRoutes } from "./operations/bootstrap.ts";
import { accountRoutes } from "./routes/account/account.ts";
import { activityRoutes } from "./routes/account/activity.ts";
import { preferenceRoutes } from "./routes/account/preferences.ts";
import { sessionRoutes } from "./routes/account/session.ts";
import { userStatusRoutes } from "./routes/account/userStatus.ts";
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
import { appRoutes } from "./routes/workspace/apps.ts";
import { assetRoutes } from "./routes/workspace/assets.ts";
import { commandRoutes } from "./routes/workspace/commands.ts";
import { emojiRoutes } from "./routes/workspace/emoji.ts";
import { searchRoutes } from "./routes/workspace/search.ts";
import { usergroupRoutes } from "./routes/workspace/usergroups.ts";
import { authPayloadError, type Credentials } from "./auth";
import { compressResponse, errorMessage } from "./http/compressedResponse";
import {
  handleClientDisconnect,
  handleClientMessage,
  handleClientOpen,
  statusMessage,
} from "./realtime";
import { matchRoute, type Route } from "./routes/router";

const APP_DIR = resolve(import.meta.dir, "../../app");
const DEV = Bun.argv.includes("--dev");

let files: Map<string, { contents: Blob; contentType: string }>;

async function build(minify?: boolean): Promise<{ html: string; outputs: Bun.BuildArtifact[] }> {
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
    sourcemap: minify ? "linked" : "inline",
    splitting: true,
    target: "browser",
  });

  for (const log of result.logs) console.error(log);
  if (!result.success) throw new Error("Build failed");

  files = new Map();
  const toUrl = (path: string) => "/" + (path.startsWith("./") ? path.slice(2) : path);
  for (const output of result.outputs)
    files.set(toUrl(output.path), { contents: output, contentType: output.type });

  const { entryPath, entryCssPaths, staleCssPaths } = resolveBuildAssets(result.outputs, toUrl);
  return {
    html: renderIndexHtml(entryPath, entryCssPaths),
    outputs: result.outputs.filter((output) => !staleCssPaths.includes(toUrl(output.path))),
  };
}

if (Bun.argv.includes("--build")) {
  await rm(`${APP_DIR}/dist`, { force: true, recursive: true });
  const { html, outputs } = await build(true);
  await Bun.write(`${APP_DIR}/dist/index.html`, html);
  for (const output of outputs) {
    const path = output.path.startsWith("./") ? output.path.slice(2) : output.path;
    await Bun.write(`${APP_DIR}/dist/${path}`, output);
  }
  process.exit();
}

const ROUTES: Route[] = [
  ...messageActionRoutes,
  ...messageRoutes,
  ...threadRoutes,
  ...conversationViewRoutes,
  ...canvasRoutes,
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
  ...emojiRoutes,
  ...assetRoutes,
  ...sessionRoutes,
];

Bun.serve<{ creds: Credentials | null }>({
  async fetch(req, server) {
    try {
      const url = new URL(req.url);
      let creds: Credentials | null = null;
      const cookieHeader = req.headers.get("cookie");
      for (const part of cookieHeader?.split(";") ?? []) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() !== "slock_creds") continue;
        try {
          const parsed = JSON.parse(decodeURIComponent(part.slice(eq + 1).trim()));
          creds = authPayloadError(parsed) === null ? parsed : null;
        } catch {}
      }

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
              json: req.json.bind(req),
            },
            creds,
            params: matched.params,
            searchParams: url.searchParams,
            range: req.headers.get("range"),
          });
        }
      } else if (req.method === "GET") {
        let file:
          | { contents: Blob | string | Bun.BunFile; contentType: string }
          | Bun.BunFile
          | undefined = undefined;
        if (url.pathname.startsWith("/public/")) {
          if (!url.pathname.includes("..")) file = Bun.file(`${APP_DIR}${url.pathname}`);
        } else if (url.pathname.startsWith("/assets/")) {
          if (!url.pathname.includes(".."))
            file = DEV ? files?.get(url.pathname) : Bun.file(`${APP_DIR}/dist${url.pathname}`);
        } else {
          if (DEV) file = { contents: (await build()).html, contentType: "text/html" };
          else file = Bun.file(`${APP_DIR}/dist/index.html`);
        }

        if (file && !("contents" in file) && (await file.exists()))
          file = { contents: file, contentType: file.type };
        if (file && "contents" in file)
          res = new Response(file.contents, { headers: { "content-type": file.contentType } });
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
