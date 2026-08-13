import type { IncomingMessage } from "node:http";
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

export function appServerPlugin(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
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
              buffer: () =>
                new Promise((resolve, reject) => {
                  const chunks: Buffer[] = [];
                  req.on("data", (chunk) => chunks.push(chunk));
                  req.on("end", () => resolve(Buffer.concat(chunks)));
                  req.on("error", reject);
                }),
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
            const response = await compressResponse(
              apiResponse,
              req.headers["accept-encoding"]?.toString() ?? null,
            );
            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              if (key !== "set-cookie") res.setHeader(key, value);
            });
            const cookies = response.headers.getSetCookie();
            if (cookies.length > 0) res.setHeader("set-cookie", cookies);
            if (response.body) {
              res.on("error", () => {});
              const reader = response.body.getReader();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done || res.destroyed) break;
                  res.write(value);
                }
              } catch {}
            }
            res.end();
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
        if (pathname !== "/ws") return;
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
