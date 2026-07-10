import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { WebSocketServer } from "ws";
import {
  authResponse,
  clients,
  configResponse,
  fileProxyResponse,
  fileUploadProxyResponse,
  handleClientMessage,
  slackEdgeRelayResponse,
  slackRelayResponse,
  startGateway,
  statusMessage,
  unfurlResponse,
} from "./relay-core";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// Uploaded file bytes go through here too, so this has to collect raw Buffer
// chunks rather than concatenating as a string — string concatenation would
// mangle binary data through implicit utf8 decoding.
function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function sendWebResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

// Wires the Slack relay (see relay-core.ts) directly into Vite's own dev
// server so `vite dev` is the only process needed in development — no
// separate backend port, and no proxy config, since the browser only ever
// talks to Vite's port.
export function slackRelayPlugin(): Plugin {
  return {
    name: "slock-slack-relay",
    configureServer(server) {
      startGateway();

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://internal");

        if (req.method === "POST" && url.pathname.startsWith("/slack/")) {
          const method = url.pathname.slice("/slack/".length);
          if (!method) {
            res.statusCode = 400;
            res.end("missing method");
            return;
          }
          const body = await readBody(req);
          let params: Record<string, string> = {};
          try {
            params = body ? JSON.parse(body) : {};
          } catch {
            // malformed body; forward an empty params object
          }
          await sendWebResponse(res, await slackRelayResponse(method, params));
          return;
        }

        if (req.method === "POST" && url.pathname.startsWith("/slack-edge/")) {
          const method = url.pathname.slice("/slack-edge/".length);
          if (!method) {
            res.statusCode = 400;
            res.end("missing method");
            return;
          }
          const body = await readBody(req);
          let params: Record<string, unknown> = {};
          try {
            params = body ? JSON.parse(body) : {};
          } catch {
            // malformed body; forward an empty params object
          }
          await sendWebResponse(res, await slackEdgeRelayResponse(method, params));
          return;
        }

        if (req.method === "GET" && url.pathname === "/file") {
          await sendWebResponse(res, await fileProxyResponse(url.searchParams.get("url")));
          return;
        }

        if (req.method === "POST" && url.pathname === "/file-upload") {
          const buffer = await readBodyBuffer(req);
          await sendWebResponse(
            res,
            await fileUploadProxyResponse(
              buffer,
              url.searchParams.get("url"),
              url.searchParams.get("filename"),
            ),
          );
          return;
        }

        if (req.method === "GET" && url.pathname === "/unfurl") {
          await sendWebResponse(res, await unfurlResponse(url.searchParams.get("url")));
          return;
        }

        if (req.method === "GET" && url.pathname === "/config") {
          await sendWebResponse(res, configResponse());
          return;
        }

        if (req.method === "POST" && url.pathname === "/auth") {
          const body = await readBody(req);
          let raw: string | undefined;
          try {
            raw = JSON.parse(body).raw;
          } catch {
            // malformed body; fall through to the missing-raw response below
          }
          if (!raw) {
            res.statusCode = 400;
            res.end("missing raw");
            return;
          }
          await sendWebResponse(res, await authResponse(raw));
          return;
        }

        next();
      });

      const wss = new WebSocketServer({ noServer: true });
      wss.on("connection", (ws) => {
        clients.add(ws);
        ws.send(statusMessage());
        ws.on("message", (raw) => handleClientMessage(String(raw)));
        ws.on("close", () => clients.delete(ws));
      });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        const { pathname } = new URL(req.url ?? "/", "http://internal");
        if (pathname !== "/ws") return; // let Vite's own HMR upgrade handler take it
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
      });
    },
  };
}
