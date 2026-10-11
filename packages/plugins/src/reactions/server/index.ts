import type { Setup } from "@slock/core";
import { errorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";

const list: Route[] = [
  route("POST", "messages/:channel/:ts/reactions", async (ctx) => {
    const { name } = await ctx.body.json<{ name?: string }>();
    if (!name) return errorResponse("invalid_reaction", 400);
    return mutate(
      "reactions.add",
      { channel: ctx.params.channel, name, timestamp: ctx.params.ts },
      ctx,
    );
  }),

  route("DELETE", "messages/:channel/:ts/reactions", async (ctx) => {
    const { name } = await ctx.body.json<{ name?: string }>();
    if (!name) return errorResponse("invalid_reaction", 400);
    return mutate(
      "reactions.remove",
      { channel: ctx.params.channel, name, timestamp: ctx.params.ts },
      ctx,
    );
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
