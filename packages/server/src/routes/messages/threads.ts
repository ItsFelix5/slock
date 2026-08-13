import { errorResponse } from "../../http/jsonResponse.ts";
import { mutate, type Route, route } from "../router.ts";

export const threadRoutes: Route[] = [
  route("POST", "/api/channels/:id/threads/:ts/subscription", (ctx) =>
    mutate("subscriptions.thread.add", { channel: ctx.params.id, thread_ts: ctx.params.ts }, ctx),
  ),
  route("DELETE", "/api/channels/:id/threads/:ts/subscription", (ctx) =>
    mutate(
      "subscriptions.thread.remove",
      { channel: ctx.params.id, thread_ts: ctx.params.ts },
      ctx,
    ),
  ),

  route("POST", "/api/channels/:id/threads/:ts/read", async (ctx) => {
    const { ts } = (await ctx.body.json()) as { ts?: string };
    if (!ts) return errorResponse("invalid_ts", 400);
    return mutate(
      "subscriptions.thread.mark",
      { channel: ctx.params.id, thread_ts: ctx.params.ts, ts },
      ctx,
    );
  }),
];
