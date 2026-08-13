import { routeApiRequest } from "./api";
import { type Credentials, parseCredsCookie } from "./auth";
import { compressResponse } from "./http/compressedResponse";
import { errorMessage } from "./http/errorMessage";
import {
  handleClientDisconnect,
  handleClientMessage,
  handleClientOpen,
  statusMessage,
} from "./realtime";

const PORT = 5174;
const DIST_DIR = `${import.meta.dir}/../dist`;

async function serveStatic(pathname: string): Promise<Response | null> {
  if (pathname.includes("..")) return null;
  const rel = pathname === "/" ? "/index.html" : pathname;
  const file = Bun.file(`${DIST_DIR}${rel}`);
  if (await file.exists()) return new Response(file);

  if (!rel.slice(rel.lastIndexOf("/") + 1).includes(".")) {
    const index = Bun.file(`${DIST_DIR}/index.html`);
    if (await index.exists()) return new Response(index);
  }
  return null;
}

Bun.serve<{ creds: Credentials | null }>({
  async fetch(req, server) {
    try {
      const url = new URL(req.url);
      const creds = parseCredsCookie(req.headers.get("cookie"));

      if (url.pathname === "/ws") {
        if (server.upgrade(req, { data: { creds } })) return;
        return new Response("upgrade failed", { status: 400 });
      }

      const apiResponse = await routeApiRequest(
        req.method,
        url.pathname,
        url.searchParams,
        creds,
        url.protocol === "https:",
        req.headers.get("accept-encoding"),
        {
          buffer: async () => new Uint8Array(await req.arrayBuffer()),
          json: () => req.json().catch(() => ({})) as Promise<Record<string, unknown>>,
          text: () => req.text().catch(() => ""),
        },
      );
      if (apiResponse) return compressResponse(apiResponse, req.headers.get("accept-encoding"));

      if (req.method === "GET") {
        const asset = await serveStatic(url.pathname);
        if (asset) return compressResponse(asset, req.headers.get("accept-encoding"));
      }

      return compressResponse(
        new Response("not found", { status: 404 }),
        req.headers.get("accept-encoding"),
      );
    } catch (error) {
      return Response.json(
        { error: errorMessage(error, "Server request failed") },
        { status: 500 },
      );
    }
  },
  hostname: "0.0.0.0",
  port: PORT,
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
