import type { Setup } from "@slock/core";
import { UPGRADED } from "@slock/server/http";
import { compressResponse } from "./api/compression";
import type { CspDirectives } from "./api/csp";
import { errorMessage } from "./api/errorMessage";

const BASE_CSP: CspDirectives = {
  "base-uri": ["'none'"],
  "connect-src": ["'self'"],
  "default-src": ["'none'"],
  "font-src": ["'self'", "data:"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "frame-src": ["'self'"],
  "img-src": ["'self'", "data:", "blob:", "https://slack-imgs.com"],
  "manifest-src": ["'self'"],
  "media-src": ["'self'", "https://slack-imgs.com"],
  "object-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "style-src-attr": ["'unsafe-inline'"],
};

function policy(contributions: (CspDirectives | (() => CspDirectives))[]): string {
  const merged = new Map(Object.entries(BASE_CSP).map(([name, values]) => [name, [...values]]));
  for (const contribution of contributions) {
    const directives = typeof contribution === "function" ? contribution() : contribution;
    for (const [name, values] of Object.entries(directives)) {
      merged.set(name, [...new Set([...(merged.get(name) ?? []), ...values])]);
    }
  }
  return [...merged].map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

const setup: Setup = (ctx) => {
  const contributions = ctx.use("http.csp");
  ctx.add(
    "http",
    async (c, next) => {
      try {
        const res = (await next()) ?? new Response("not found", { status: 404 });
        if (res === UPGRADED) return res;
        res.headers.set("content-security-policy", policy(contributions()));
        res.headers.set("x-content-type-options", "nosniff");
        return await compressResponse(res, c.req.headers.get("accept-encoding"));
      } catch (error) {
        return Response.json(
          { error: errorMessage(error, "Server request failed") },
          { status: 500 },
        );
      }
    },
    { order: 1000 },
  );
};

export default setup;
