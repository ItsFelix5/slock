import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { acceptUpgrade } from "./dev-websocket.ts";
import { parseCredsCookie, routeRelayRequest } from "./relay-core.ts";
import {
  handleClientDisconnect,
  handleClientMessage,
  handleClientOpen,
  statusMessage,
} from "./relay-gateway.ts";

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
  // A client that disconnects mid-download (nav away, aborted fetch) makes
  // res.write() throw/error — swallow it and stop, don't let it bubble.
  res.on("error", () => {});
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (res.destroyed) break;
      res.write(value);
    }
  } catch {
    // client went away mid-stream
  }
  res.end();
}

// Wires the Slack relay (see relay-core.ts) directly into Vite's own dev
// server so `vite dev` is the only process needed in development — no
// separate backend port, and no proxy config, since the browser only ever
// talks to Vite's port.
export function slackRelayPlugin(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // A dropped connection (client aborts an upload/nav away mid-request)
        // rejects readBody's promise; Vite's connect stack won't catch that
        // rejection from an async middleware, so an uncaught one here takes
        // down the whole dev server process. Keep everything inside this try.
        try {
          const url = new URL(req.url ?? "/", "http://internal");
          const creds = parseCredsCookie(req.headers.cookie ?? null);

          const relayRes = await routeRelayRequest(
            req.method ?? "GET",
            url.pathname,
            url.searchParams,
            creds,
            false,
            req.headers["accept-encoding"]?.toString() ?? null,
            {
              buffer: () => readBodyBuffer(req),
              json: async () => {
                const raw = await readBody(req);
                try {
                  return raw ? JSON.parse(raw) : {};
                } catch {
                  return {};
                }
              },
              text: () => readBody(req),
            },
          );
          if (relayRes) {
            await sendWebResponse(res, relayRes);
            return;
          }

          next();
        } catch (err) {
          if (res.headersSent || res.destroyed) return;
          console.warn("slock-slack-relay middleware error:", err);
          res.statusCode = 500;
          res.end();
        }
      });

      server.httpServer?.on("upgrade", (req, socket) => {
        const { pathname } = new URL(req.url ?? "/", "http://internal");
        if (pathname !== "/ws") return; // let Vite's own HMR upgrade handler take it
        const key = req.headers["sec-websocket-key"];
        if (typeof key !== "string") {
          socket.destroy();
          return;
        }
        const creds = parseCredsCookie(req.headers.cookie ?? null);
        const client = acceptUpgrade(
          socket,
          key,
          (raw, c) => handleClientMessage(raw, c),
          (c) => handleClientDisconnect(c),
        );
        client.send(statusMessage(false));
        handleClientOpen(client, creds);
      });
    },
    name: "slock-slack-relay",
  };
}
