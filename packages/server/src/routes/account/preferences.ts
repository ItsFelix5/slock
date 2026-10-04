import { errorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import type { PrefsReply } from "../../slackReplies.ts";
import { mutate, type Route, type RouteCtx, route } from "../router.ts";

function prefWrite(name: string, value: string, ctx: RouteCtx) {
  return mutate("users.prefs.set", { name, value }, ctx);
}

export const preferenceRoutes: Route[] = [
  route("PUT", "preferences/channel-sections", async (ctx) => {
    const { sections } = await ctx.body.json<{
      sections?: Record<string, Record<string, unknown>>;
    }>();
    if (!sections) return errorResponse("invalid_sections", 400);
    return prefWrite("channel_sections", JSON.stringify(sections), ctx);
  }),

  route("PUT", "preferences/muted-channels", async (ctx) => {
    const { channelIds } = await ctx.body.json<{ channelIds?: string[] }>();
    if (!channelIds) return errorResponse("invalid_channel_ids", 400);
    return prefWrite("muted_channels", channelIds.join(","), ctx);
  }),

  route("PUT", "preferences/highlight-words", async (ctx) => {
    const { words } = await ctx.body.json<{ words?: string[] }>();
    if (!words) return errorResponse("invalid_words", 400);
    const current = await callSlack<PrefsReply>("users.prefs.get", {}, ctx.creds);
    if (!current.ok) return errorResponse(current.error ?? "users.prefs.get failed", 400);
    const allNotifications = JSON.parse(current.prefs?.all_notifications_prefs ?? "{}");
    allNotifications.global = { ...allNotifications.global, global_keywords: words.join(",") };
    return prefWrite("all_notifications_prefs", JSON.stringify(allNotifications), ctx);
  }),

  route("PUT", "dnd/snooze", async (ctx) => {
    const { minutes } = await ctx.body.json<{ minutes?: number }>();
    if (!minutes) return errorResponse("invalid_minutes", 400);
    return mutate("dnd.setSnooze", { num_minutes: String(minutes) }, ctx);
  }),

  route("DELETE", "dnd/snooze", (ctx) => mutate("dnd.endSnooze", {}, ctx)),
];
