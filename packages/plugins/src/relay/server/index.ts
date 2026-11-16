import type { Setup } from "@slock/core";
import { errorResponse, jsonResponse } from "../../slack/server/api/jsonResponse";
import { callRelay, relayUrl } from "../../slack/server/api/relayMessages";
import { route, routes } from "../../slack/server/api/router";
import { setRelayToken } from "../../slack/server/api/session";

const TOKEN_SHAPE = /^[\w.-]{1,2048}$/;

const list = [
  route("GET", "relay", (ctx) =>
    jsonResponse({ available: !!relayUrl(), connected: !!ctx.creds?.relayToken }, ctx.creds),
  ),

  route("PUT", "relay/token", async (ctx) => {
    if (!relayUrl()) return errorResponse("relay_not_configured", 400);
    const { token } = await ctx.body.json<{ token?: string }>();
    const trimmed = token?.trim() ?? "";
    if (!TOKEN_SHAPE.test(trimmed)) return errorResponse("invalid_token", 400);
    const checked = await callRelay(trimmed, "GET", "/me");
    if (!checked.ok) {
      return errorResponse(checked.error, checked.error === "invalid_token" ? 400 : 502);
    }
    return setRelayToken(ctx.cookie, trimmed);
  }),

  route("DELETE", "relay/token", (ctx) => setRelayToken(ctx.cookie, null)),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
