import type { Setup } from "@slock/core";
import { slackAssetResponse } from "../../slack/server/api/assets";
import { route, routes } from "../../slack/server/api/router";
import { createEmojiCache } from "./cache";

const setup: Setup = (ctx) => {
  const cache = createEmojiCache();
  ctx.add(
    "http",
    routes([
      route(
        "GET",
        "emoji",
        async (rc) =>
          new Response(JSON.stringify(await cache.list(rc.creds)), {
            headers: {
              "cache-control": "private, no-cache",
              "content-type": "application/json; charset=utf-8",
              vary: "Cookie",
            },
          }),
      ),
      route("GET", "emoji/:name", async (rc) => {
        const url = await cache.imageUrl(rc.params.name, rc.creds);
        const res = await slackAssetResponse(url, rc.creds, rc.acceptEncoding, rc.range);
        res.headers.append("vary", "Cookie");
        return res;
      }),
    ]),
  );
  ctx.add("realtime.event", {
    handle: (_event, creds) => cache.invalidate(creds),
    types: ["emoji_changed"],
  });
};

export default setup;
