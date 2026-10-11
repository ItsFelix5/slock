import type { Setup } from "@slock/core";
import { errorResponse, jsonResponse } from "../../slack/server/api/jsonResponse";
import { route, routes } from "../../slack/server/api/router";
import { lookupFlaronChannel, reportFlaronChannelNames } from "./lookup";

const reportRoutes = [
  route("POST", "channels/flaron-report", async (ctx) => {
    const { names } = await ctx.body.json<{ names?: string[] }>();
    if (!names?.length) return errorResponse("invalid_names", 400);
    await reportFlaronChannelNames(names);
    return jsonResponse({ ok: true }, ctx.creds);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(reportRoutes));
  ctx.add("channels.lookup", async (id) => {
    const found = await lookupFlaronChannel(id);
    return (
      found && {
        id: found.id,
        is_private: found.private,
        name: found.name,
        topic: found.topic,
      }
    );
  });
};

export default setup;
