import type { Setup } from "@slock/core";
import { errorResponse, jsonResponse } from "../../slack/server/api/jsonResponse";
import { route, routes } from "../../slack/server/api/router";
import { lookupFlaronChannel, reportFlaronChannelNames } from "./lookup";

const MAX_NAMES = 200;
const isChannelName = (name: unknown): name is string =>
  typeof name === "string" && name.length <= 80;

const reportRoutes = [
  route("POST", "channels/flaron-report", async (ctx) => {
    if (!ctx.creds) return errorResponse("not configured", 401);
    const { names } = await ctx.body.json<{ names?: unknown[] }>();
    if (!(names?.length && names.length <= MAX_NAMES && names.every(isChannelName))) {
      return errorResponse("invalid_names", 400);
    }
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
