import type { Setup } from "@slock/core";
import { parseCredentials } from "@slock/plugins/slack/server/api/auth";
import { route, routes } from "@slock/plugins/slack/server/api/router";
import { connectAccount } from "@slock/plugins/slack/server/api/session";
import { parseSlackCurl } from "./parseSlackCurl";

const list = [
  route("POST", "curl-login/connect", async (ctx) => {
    const { curl } = await ctx.body.json<{ curl: string }>();
    const parsed = parseCredentials(parseSlackCurl(curl));
    if (!parsed.ok) throw new Error(parsed.error);
    return connectAccount(ctx.cookie, parsed.credentials);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
