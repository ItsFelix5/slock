import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { routeApiRequest } from "./api.ts";
import { parseCredsCookie } from "./auth.ts";
import { acceptUpgrade } from "./dev-websocket.ts";
import { compressResponse } from "./http/compressedResponse.ts";
import { errorMessage } from "./http/errorMessage.ts";
import {
  handleClientDisconnect,
  handleClientMessage,
  handleClientOpen,
  statusMessage,
} from "./realtime.ts";

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
    // Set-Cookie is special-cased by the Fetch spec: multiple instances are
    // never comma-joined, so forEach yields one ("set-cookie", value) pair
    // per cookie. res.setHeader would overwrite on each call and silently
    // drop all but the last cookie — use getSetCookie() and set them together.
    if (key === "set-cookie") return;
    res.setHeader(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
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

// Mounts the application API directly in Vite during development so the same
// request handlers are used in development and production.
export function appServerPlugin(): Plugin {
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

          const apiResponse = await routeApiRequest(
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
          if (apiResponse) {
            await sendWebResponse(
              res,
              await compressResponse(
                apiResponse,
                req.headers["accept-encoding"]?.toString() ?? null,
              ),
            );
            return;
          }

          next();
        } catch (err) {
          if (res.headersSent || res.destroyed) return;
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: errorMessage(err, "API request failed") }));
        }
      });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        const { pathname } = new URL(req.url ?? "/", "http://internal");
        if (pathname !== "/ws") return; // let Vite's own HMR upgrade handler take it
        const creds = parseCredsCookie(req.headers.cookie ?? null);
        acceptUpgrade(
          req,
          socket,
          head,
          (client) => {
            client.send(statusMessage(false));
            handleClientOpen(client, creds);
          },
          (raw, c) => handleClientMessage(raw, c),
          (c) => handleClientDisconnect(c),
        );
      });
    },
    name: "slock-app-server",
  };
}
