import type { Setup } from "@slock/core";
import { teamIdFromRoute } from "../../slack/server/api/auth";
import { cachedEntityForId } from "../../slack/server/api/cachedEntity";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route, RouteCtx } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack, callSlackEdge } from "../../slack/server/api/slackClient";
import type {
  ChannelInfoReply,
  ChannelReply,
  EdgeChannelsInfoReply,
  EdgeChannelsReply,
} from "../../slack/server/api/slackReplies";
import { isHostedChannel, trimChannel } from "../../slack/server/api/trim/slackChannels";
import type { ChannelResolver } from "./api";

async function mutateChannel(
  slackMethod: string,
  params: Record<string, string>,
  ctx: RouteCtx,
): Promise<Response> {
  const data = await callSlack<ChannelReply>(slackMethod, params, ctx.creds);
  if (!data.ok) return slackErrorResponse(data, slackMethod, ctx.creds);
  return jsonResponse({ channel: trimChannel(data.channel), ok: true }, ctx.creds);
}

function lookupRoute(resolvers: () => ChannelResolver[]): Route {
  return route("POST", "channels/lookup", async (ctx) => {
    const { ids } = await ctx.body.json<{ ids?: string[] }>();
    if (!ids?.length) return errorResponse("invalid_ids", 400);
    const data = await callSlackEdge<EdgeChannelsInfoReply>(
      "channels/info",
      { updated_ids: Object.fromEntries(ids.map((id) => [id, 0])) },
      ctx.creds,
    );

    if (!data.ok && data.error !== "channel_not_found") {
      return slackErrorResponse(data, "edge channels/info", ctx.creds);
    }
    const entries = await Promise.all(
      ids.map(async (id) => {
        const raw = data.ok
          ? cachedEntityForId(
              { index: data.channels, results: data.results, single: data.channel },
              id,
            )
          : undefined;
        if (raw?.id && (raw.name || isHostedChannel(raw))) return [id, trimChannel(raw)] as const;
        for (const resolve of resolvers()) {
          const found = await resolve(id, ctx.creds);
          if (found) return [id, found] as const;
        }
        return [id, null] as const;
      }),
    );
    return jsonResponse({ channels: Object.fromEntries(entries), ok: true }, ctx.creds);
  });
}

const list: Route[] = [
  route("GET", "channels/browse", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ items: [], ok: true }, ctx.creds);
    const data = await callSlackEdge<EdgeChannelsReply>(
      "channels/search",
      {
        check_membership: true,
        count: 40,
        default_workspace: ctx.creds ? teamIdFromRoute(ctx.creds.route) : undefined,
        filter: "xws",
        fuzz: 1,
        include_record_channels: false,
        query,
      },
      ctx.creds,
    );
    if (!(data.ok && data.results)) {
      return slackErrorResponse(
        data.ok ? { error: "channels/search returned no results" } : data,
        "edge channels/search",
        ctx.creds,
      );
    }
    return jsonResponse(
      {
        items: data.results.filter((channel) => !isHostedChannel(channel)).map(trimChannel),
        ok: true,
      },
      ctx.creds,
    );
  }),

  route("POST", "channels", async (ctx) => {
    const { name, isPrivate } = await ctx.body.json<{
      name?: string;
      isPrivate?: boolean;
    }>();
    if (!name) return errorResponse("invalid_name", 400);
    const data = await callSlack<ChannelReply>(
      "conversations.create",
      { is_private: isPrivate ? "true" : "false", name },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.create", ctx.creds);
    }
    return jsonResponse({ channel: trimChannel(data.channel), ok: true }, ctx.creds);
  }),

  route("GET", "channels/:id", async (ctx) => {
    const data = await callSlack<ChannelInfoReply>(
      "conversations.info",
      { channel: ctx.params.id, include_num_members: "true" },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.info", ctx.creds);
    }
    return jsonResponse({ channel: trimChannel(data.channel), ok: true }, ctx.creds);
  }),

  route("PATCH", "channels/:id", async (ctx) => {
    const { name } = await ctx.body.json<{ name?: string }>();
    if (!name) return errorResponse("invalid_name", 400);
    const data = await callSlack<ChannelReply>(
      "conversations.rename",
      { channel: ctx.params.id, name },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "conversations.rename", ctx.creds);
    }
    return jsonResponse({ channel: { name: data.channel.name ?? name }, ok: true }, ctx.creds);
  }),

  route("POST", "channels/:id/join", (ctx) =>
    mutateChannel("conversations.join", { channel: ctx.params.id }, ctx),
  ),

  route("POST", "channels/:id/leave", (ctx) =>
    mutate("conversations.leave", { channel: ctx.params.id }, ctx),
  ),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes([...list, lookupRoute(ctx.use("channels.lookup"))]));
};

export default setup;
