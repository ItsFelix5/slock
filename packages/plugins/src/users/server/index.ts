import type { Setup } from "@slock/core";
import { teamIdFromRoute } from "@slock/plugins/slack/server/api/auth";
import { cachedEntityForId } from "@slock/plugins/slack/server/api/cachedEntity";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "@slock/plugins/slack/server/api/jsonResponse";
import type { Route } from "@slock/plugins/slack/server/api/router";
import { route, routes } from "@slock/plugins/slack/server/api/router";
import { callSlack, callSlackEdge } from "@slock/plugins/slack/server/api/slackClient";
import type { EdgeUsersReply, EntityIndex } from "@slock/plugins/slack/server/api/slackReplies";
import { trimIcons, trimUser } from "@slock/plugins/slack/server/api/trim/slackEntities";
import { isUserId } from "@slock/slack";
import type { RawBot, RawUser } from "@slock/types";
import type { UserDecorator } from "./api";

function userRoutes(decorators: () => UserDecorator[]): Route[] {
  return [
    route("GET", "bots/:id", async (ctx) => {
      const data = await callSlack<BotReply>("bots.info", { bot: ctx.params.id }, ctx.creds);
      if (!data.ok) return slackErrorResponse(data, "bots.info");
      return jsonResponse({ bot: trimBot(data.bot), ok: true });
    }),

    route("POST", "users/lookup", async (ctx) => {
      const { ids } = await ctx.body.json<{ ids?: string[] }>();
      if (!(ids?.length && ids.every(isUserId))) return errorResponse("invalid_ids", 400);
      const data = await callSlackEdge<EdgeUsersInfoReply>(
        "users/info",
        {
          include_profile_only_users: true,
          updated_ids: Object.fromEntries(ids.map((id) => [id, 0])),
        },
        ctx.creds,
      );
      if (!data.ok) {
        return slackErrorResponse(data, "edge users/info");
      }
      return jsonResponse({
        ok: true,
        users: Object.fromEntries(
          ids.map((id) => {
            const user = cachedEntityForId(
              { index: data.users, results: data.results, single: data.user },
              id,
            );
            if (!user) return [id, null];
            const trimmed = trimUser(user);
            const extra = Object.assign(
              {},
              ...decorators().map((decorate) => decorate(trimmed, ctx.creds)),
            );
            return [id, { ...trimmed, ...extra }];
          }),
        ),
      });
    }),

    route("GET", "directory", async (ctx) => {
      const query = ctx.searchParams.get("query")?.trim();
      if (!query) return jsonResponse({ truncated: false, users: [] });
      const teamId = ctx.creds ? teamIdFromRoute(ctx.creds.route) : null;
      const data = await callSlackEdge<EdgeUsersReply>(
        "users/search",
        {
          count: 30,
          default_workspace: teamId,
          enable_workspace_ranking: true,
          fuzz: 1,
          include_profile_only_users: true,
          query,
        },
        ctx.creds,
      );
      if (!data.ok) {
        return slackErrorResponse(data, "users.search");
      }
      return jsonResponse({
        truncated: !!data.truncated,
        users: data.results?.map(trimUser) ?? [],
        ok: true,
      });
    }),
  ];
}

const setup: Setup = (ctx) => {
  ctx.add("http", routes(userRoutes(ctx.use("users.decorate"))));
};

export default setup;

type EdgeUsersInfoReply = {
  results?: EntityIndex<RawUser>;
  user?: RawUser;
  users?: EntityIndex<RawUser>;
};

type BotReply = { bot: RawBot };

function trimBot(bot: RawBot): RawBot {
  return {
    app_id: bot.app_id,
    icons: trimIcons(bot.icons),
    id: bot.id,
    name: bot.name,
    user_id: bot.user_id,
  };
}
