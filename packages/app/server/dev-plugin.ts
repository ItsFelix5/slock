import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { WebSocketServer } from "ws";
import {
  handleClientDisconnect,
  handleClientMessage,
  handleClientOpen,
  parseCredsCookie,
  routeRelayRequest,
  statusMessage,
} from "./relay-core.ts";

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
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://internal");
        const creds = parseCredsCookie(req.headers.cookie ?? null);

        const relayRes = await routeRelayRequest(
          req.method ?? "GET",
          url.pathname,
          url.searchParams,
          creds,
          false,
          {
            json: async () => {
              const raw = await readBody(req);
              try {
                return raw ? JSON.parse(raw) : {};
              } catch {
                return {};
              }
            },
            text: () => readBody(req),
            buffer: () => readBodyBuffer(req),
          },
        );
        if (relayRes) {
          await sendWebResponse(res, relayRes);
          return;
        }

        next();
      });

      const wss = new WebSocketServer({ noServer: true });
      wss.on("connection", (ws, req: IncomingMessage) => {
        const creds = parseCredsCookie(req.headers.cookie ?? null);
        ws.send(statusMessage(false));
        handleClientOpen(ws, creds);
        ws.on("message", (raw) => handleClientMessage(String(raw), ws));
        ws.on("close", () => handleClientDisconnect(ws));
      });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        const { pathname } = new URL(req.url ?? "/", "http://internal");
        if (pathname !== "/ws") return; // let Vite's own HMR upgrade handler take it
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
      });
    },
  };
}
