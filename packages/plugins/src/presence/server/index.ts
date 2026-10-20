import type { Setup } from "@slock/core";
import { errorResponse, jsonResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { PresenceSeen } from "./api";

function presenceRoutes(seen: () => PresenceSeen[]): Route[] {
  return [
    route("POST", "users/presence", async (ctx) => {
      const { ids } = await ctx.body.json<{ ids?: string[] }>();
      if (!ids?.length) return errorResponse("invalid_ids", 400);
      const entries = await Promise.all(
        ids.map(async (id) => {
          const data = await callSlack<{ presence?: string }>(
            "users.getPresence",
            { user: id },
            ctx.creds,
          );
          if (!data.ok) return [id, null] as const;
          const presence = data.presence === "away" ? "away" : "active";
          const { creds } = ctx;
          if (presence === "active" && creds) for (const record of seen()) record(id, creds);
          return [id, presence] as const;
        }),
      );
      return jsonResponse({ ok: true, presence: Object.fromEntries(entries) }, ctx.creds);
    }),

    route("POST", "presence/activity", async (ctx) => {
      const current = await callSlack<{ manual_away?: boolean; presence?: string }>(
        "users.getPresence",
        {},
        ctx.creds,
      );
      if (!current.ok) return errorResponse(current.error, 502);
      const activate = current.presence === "away" && !current.manual_away;
      if (activate) {
        const set = await callSlack("users.setPresence", { presence: "auto" }, ctx.creds);
        if (!set.ok) return errorResponse(set.error, 502);
      }
      return jsonResponse({ activated: activate, ok: true }, ctx.creds);
    }),

    route("PUT", "presence", async (ctx) => {
      const { presence } = await ctx.body.json<{
        presence?: "auto" | "away";
      }>();
      if (!presence) return errorResponse("invalid_presence", 400);
      return mutate("users.setPresence", { presence }, ctx);
    }),
  ];
}

const setup: Setup = (ctx) => {
  ctx.add("http", routes(presenceRoutes(ctx.use("presence.seen"))));
};

export default setup;
