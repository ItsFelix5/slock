import { errorResponse } from "../../http/jsonResponse.ts";
import { mutate, type Route, type RouteCtx, route } from "../router.ts";

function prefWrite(name: string, value: string, ctx: RouteCtx) {
  return mutate("users.prefs.set", { name, value }, ctx);
}

export const preferenceRoutes: Route[] = [
  route("PUT", "/api/preferences/channel-sections", async (ctx) => {
    const { sections } = (await ctx.body.json()) as {
      sections?: Record<string, Record<string, unknown>>;
    };
    if (!sections) return errorResponse("invalid_sections", 400);
    return prefWrite("channel_sections", JSON.stringify(sections), ctx);
  }),

  route("PUT", "/api/preferences/muted-channels", async (ctx) => {
    const { channelIds } = (await ctx.body.json()) as { channelIds?: string[] };
    if (!channelIds) return errorResponse("invalid_channel_ids", 400);
    return prefWrite("muted_channels", channelIds.join(","), ctx);
  }),

  route("PUT", "/api/preferences/highlight-words", async (ctx) => {
    const { words } = (await ctx.body.json()) as { words?: string[] };
    if (!words) return errorResponse("invalid_words", 400);
    return prefWrite("highlight_words", words.join(","), ctx);
  }),

  route("PUT", "/api/preferences/theme-colors", async (ctx) => {
    const { colors, colorScheme } = (await ctx.body.json()) as {
      colors?: Record<string, string>;
      colorScheme?: "dark" | "light";
    };
    if (!(colors && colorScheme)) return errorResponse("invalid_theme_colors", 400);
    return prefWrite("slock_theme_colors", JSON.stringify({ colors, colorScheme }), ctx);
  }),

  route("PUT", "/api/preferences/theme-shape", async (ctx) => {
    const { density, roundness } = (await ctx.body.json()) as {
      density?: number;
      roundness?: number;
    };
    if (typeof density !== "number" || typeof roundness !== "number")
      return errorResponse("invalid_theme_shape", 400);
    return prefWrite("slock_theme_shape", JSON.stringify({ density, roundness }), ctx);
  }),

  route("PUT", "/api/dnd/snooze", async (ctx) => {
    const { minutes } = (await ctx.body.json()) as { minutes?: number };
    if (!minutes) return errorResponse("invalid_minutes", 400);
    return mutate("dnd.setSnooze", { num_minutes: String(minutes) }, ctx);
  }),

  route("DELETE", "/api/dnd/snooze", (ctx) => mutate("dnd.endSnooze", {}, ctx)),
];
