// Production entry point: one process serving the built static client plus
// the Slack relay (see relay-core.ts) on a single port. There's no Vite here
// (that's dev-only, see dev-plugin.ts) — just static files and the relay.
import {
  type Credentials,
  handleClientDisconnect,
  handleClientMessage,
  handleClientOpen,
  parseCredsCookie,
  routeRelayRequest,
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

Bun.serve<{ creds: Credentials | null }>({
  hostname: "0.0.0.0",
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);
    const creds = parseCredsCookie(req.headers.get("cookie"));

    if (url.pathname === "/ws") {
      // Cookies auto-attach to a same-origin WS handshake, so creds parsed
      // above from this same upgrade request travel through as `ws.data`.
      if (server.upgrade(req, { data: { creds } })) return;
      return new Response("upgrade failed", { status: 400 });
    }

    const relayRes = await routeRelayRequest(
      req.method,
      url.pathname,
      url.searchParams,
      creds,
      url.protocol === "https:",
      {
        json: () => req.json().catch(() => ({})),
        text: () => req.text().catch(() => ""),
        buffer: async () => new Uint8Array(await req.arrayBuffer()),
      },
    );
    if (relayRes) return relayRes;

    if (req.method === "GET") {
      const asset = await serveStatic(url.pathname);
      if (asset) return asset;
    }

    return new Response("not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      ws.send(statusMessage(false));
      handleClientOpen(ws, ws.data.creds);
    },
    close(ws) {
      handleClientDisconnect(ws);
    },
    message(ws, raw) {
      handleClientMessage(String(raw), ws);
    },
  },
});

console.log(`Slock listening on http://0.0.0.0:${PORT}`);
