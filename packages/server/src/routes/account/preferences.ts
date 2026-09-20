import { errorResponse } from "../../http/jsonResponse.ts";
import { mutate, type Route, type RouteCtx, route } from "../router.ts";

function prefWrite(name: string, value: string, ctx: RouteCtx) {
  return mutate("users.prefs.set", { name, value }, ctx);
}

export const preferenceRoutes: Route[] = [
  route("PUT", "preferences/channel-sections", async (ctx) => {
    const { sections } = await (ctx.body.json() as Promise<{
      sections?: Record<string, Record<string, unknown>>;
    }>);
    if (!sections) return errorResponse("invalid_sections", 400);
    return prefWrite("channel_sections", JSON.stringify(sections), ctx);
  }),

  route("PUT", "preferences/muted-channels", async (ctx) => {
    const { channelIds } = await (ctx.body.json() as Promise<{ channelIds?: string[] }>);
    if (!channelIds) return errorResponse("invalid_channel_ids", 400);
    return prefWrite("muted_channels", channelIds.join(","), ctx);
  }),

  route("PUT", "preferences/highlight-words", async (ctx) => {
    const { words } = await (ctx.body.json() as Promise<{ words?: string[] }>);
    if (!words) return errorResponse("invalid_words", 400);
    return prefWrite("highlight_words", words.join(","), ctx);
  }),

  route("PUT", "dnd/snooze", async (ctx) => {
    const { minutes } = await (ctx.body.json() as Promise<{ minutes?: number }>);
    if (!minutes) return errorResponse("invalid_minutes", 400);
    return mutate("dnd.setSnooze", { num_minutes: String(minutes) }, ctx);
  }),

  route("DELETE", "dnd/snooze", (ctx) => mutate("dnd.endSnooze", {}, ctx)),
];
