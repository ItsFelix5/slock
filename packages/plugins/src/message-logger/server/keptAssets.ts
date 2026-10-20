import type { HttpHandler } from "@slock/core";
import { ASSET_PATH, safeTypeHeaders } from "../../slack/server/api/assets";
import type { LogStore } from "./store";
import { ownerOf } from "./workspace";

export function serveKeptAssets(store: LogStore): HttpHandler {
  return async (c, next) => {
    const res = await next();
    if (res?.ok || c.req.method !== "GET" || !c.creds) return res;
    if (c.url.pathname !== ASSET_PATH) return res;
    const url = c.url.searchParams.get("url");
    const blob = url && store.blob(ownerOf(c.creds), url);
    if (!blob) return res;
    return new Response(blob.bytes, {
      headers: {
        "cache-control": "private, max-age=86400",
        ...safeTypeHeaders(blob.type),
        vary: "Cookie",
      },
    });
  };
}
