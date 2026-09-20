import { namedSlackAssetResponse } from "../../assets.ts";
import { emojiImageUrl, emojiListResponse } from "../../emoji.ts";
import { callSlack } from "../../slackClient.ts";
import { type Route, route } from "../router.ts";

export const emojiRoutes: Route[] = [
  route("GET", "emoji", (ctx) => emojiListResponse(ctx.creds, callSlack, ctx.acceptEncoding)),
  route("GET", "emoji/:name", async (ctx) => {
    const url = await emojiImageUrl(ctx.params.name, ctx.creds, callSlack);
    const res = await namedSlackAssetResponse(url, ctx.creds, ctx.acceptEncoding, ctx.range);
    res.headers.append("vary", "Cookie");
    return res;
  }),
];
