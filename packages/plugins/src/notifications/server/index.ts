import type { Setup } from "@slock/core";
import { errorResponse } from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { prefWrite, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { PrefsReply } from "../../slack/server/api/slackReplies";

const list: Route[] = [
  route("PUT", "preferences/highlight-words", async (ctx) => {
    const { words } = await ctx.body.json<{ words?: string[] }>();
    if (!words) return errorResponse("invalid_words", 400);
    const current = await callSlack<PrefsReply>("users.prefs.get", {}, ctx.creds);
    if (!current.ok) return errorResponse(current.error ?? "users.prefs.get failed", 400);
    const allNotifications = JSON.parse(current.prefs?.all_notifications_prefs ?? "{}");
    allNotifications.global = { ...allNotifications.global, global_keywords: words.join(",") };
    return prefWrite("all_notifications_prefs", JSON.stringify(allNotifications), ctx);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
