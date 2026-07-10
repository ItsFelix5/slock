// Production entry point: one process serving the built static client plus
// the Slack relay (see relay-core.ts) on a single port. There's no Vite here
// (that's dev-only, see dev-plugin.ts) — just static files and the relay.
import {
  clients,
  configResponse,
  fileProxyResponse,
  handleClientMessage,
  slackEdgeRelayResponse,
  slackRelayResponse,
  startGateway,
  statusMessage,
} from "./relay-core";

const PORT = Number(process.env.PORT ?? 5174);
const DIST_DIR = `${import.meta.dir}/../dist`;

async function serveStatic(pathname: string): Promise<Response | null> {
  if (pathname.includes("..")) return null;
  const rel = pathname === "/" ? "/index.html" : pathname;
  const file = Bun.file(`${DIST_DIR}${rel}`);
  if (await file.exists()) return new Response(file);
  // SPA fallback: client-side routes (no file extension) fall back to index.html.
  if (!rel.slice(rel.lastIndexOf("/") + 1).includes(".")) {
    const index = Bun.file(`${DIST_DIR}/index.html`);
    if (await index.exists()) return new Response(index);
  }
  return null;
}

startGateway();

Bun.serve({
  hostname: "0.0.0.0",
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return;
      return new Response("upgrade failed", { status: 400 });
    }

    if (req.method === "POST" && url.pathname.startsWith("/slack/")) {
      const method = url.pathname.slice("/slack/".length);
      if (!method) return new Response("missing method", { status: 400 });
      const params = (await req.json().catch(() => ({}))) as Record<string, string>;
      return slackRelayResponse(method, params);
    }

    if (req.method === "POST" && url.pathname.startsWith("/slack-edge/")) {
      const method = url.pathname.slice("/slack-edge/".length);
      if (!method) return new Response("missing method", { status: 400 });
      const params = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      return slackEdgeRelayResponse(method, params);
    }

    if (url.pathname === "/file") {
      return fileProxyResponse(url.searchParams.get("url"));
    }

    if (req.method === "GET" && url.pathname === "/config") {
      return configResponse();
    }

    if (req.method === "GET") {
      const asset = await serveStatic(url.pathname);
      if (asset) return asset;
    }

    return new Response("not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      clients.add(ws);
      ws.send(statusMessage());
    },
    close(ws) {
      clients.delete(ws);
    },
    message(_ws, raw) {
      handleClientMessage(String(raw));
    },
  },
});

console.log(`Slock listening on http://0.0.0.0:${PORT}`);
