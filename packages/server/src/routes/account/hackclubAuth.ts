import { type EmailChallenge, exchangeEmailCode, requestEmailCode } from "../../hackclubAuth.ts";
import { type Route, route } from "../router.ts";

export const hackclubAuthRoutes: Route[] = [
  route("POST", "hackclub-auth/email", async (ctx) => {
    const { email } = await ctx.body.json<{ email: string }>();
    const challenge = await requestEmailCode(email);
    return Response.json({ challenge });
  }),

  route("POST", "hackclub-auth/verify", async (ctx) => {
    const { challenge, code } = await ctx.body.json<{ challenge: EmailChallenge; code: string }>();
    const credentials = await exchangeEmailCode(challenge, code);
    return Response.json({ credentials });
  }),
];
