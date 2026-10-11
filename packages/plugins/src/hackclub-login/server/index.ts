import type { Setup } from "@slock/core";
import { route, routes } from "../../slack/server/api/router";
import { connectAccount } from "../../slack/server/api/session";
import { type EmailChallenge, exchangeEmailCode, requestEmailCode } from "./hackclubAuth";

const list = [
  route("POST", "hackclub-auth/email", async (ctx) => {
    const { email } = await ctx.body.json<{ email: string }>();
    return Response.json({ challenge: await requestEmailCode(email) });
  }),

  route("POST", "hackclub-auth/verify", async (ctx) => {
    const { challenge, code } = await ctx.body.json<{ challenge: EmailChallenge; code: string }>();
    return connectAccount(ctx.cookie, await exchangeEmailCode(challenge, code));
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
