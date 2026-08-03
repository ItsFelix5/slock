// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { errorResponse } from "../http/jsonResponse.ts";
import { mutate, type Route, type RouteCtx, route } from "./router.ts";

// Slack's users.prefs.set is a generic name/value KV write - the account's
// real local-usage-database mechanism the webapp itself uses for settings
// with no dedicated method, and for this app's own invented keys
// (slock_* below) synced the same real way instead of falling back to
// localStorage. Each route here names one concern rather than exposing that
// generic name/value shape directly to the browser.
function prefWrite(name: string, value: string, ctx: RouteCtx) {
  return mutate("users.prefs.set", { name, value }, ctx);
}

export const preferenceRoutes: Route[] = [
  route("PUT", "/api/preferences/usergroup-section-order", async (ctx) => {
    const { sectionIds } = (await ctx.body.json()) as { sectionIds?: string[] };
    if (!sectionIds) return errorResponse("invalid_section_ids", 400);
    return prefWrite("slock_usergroup_section_order", JSON.stringify(sectionIds), ctx);
  }),

  route("PUT", "/api/preferences/usergroup-section-sidebar", async (ctx) => {
    const { entries } = (await ctx.body.json()) as {
      entries?: Record<string, "hid" | "active" | "all">;
    };
    if (!entries) return errorResponse("invalid_entries", 400);
    return prefWrite("slock_usergroup_section_sidebar", JSON.stringify(entries), ctx);
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

  route("PUT", "/api/preferences/desktop-notifications", async (ctx) => {
    const { enabled } = (await ctx.body.json()) as { enabled?: boolean };
    if (enabled === undefined) return errorResponse("invalid_enabled", 400);
    return prefWrite("slock_desktop_notifications", enabled ? "on" : "off", ctx);
  }),

  route("PUT", "/api/preferences/search-history", async (ctx) => {
    const { queries } = (await ctx.body.json()) as { queries?: string[] };
    if (!queries) return errorResponse("invalid_queries", 400);
    return prefWrite("slock_search_history", JSON.stringify(queries), ctx);
  }),

  route("PUT", "/api/preferences/channel-tabs", async (ctx) => {
    const { entries } = (await ctx.body.json()) as {
      entries?: Record<string, { type: string }[]>;
    };
    if (!entries) return errorResponse("invalid_entries", 400);
    return prefWrite("slock_channel_tabs", JSON.stringify(entries), ctx);
  }),

  route("PUT", "/api/dnd/snooze", async (ctx) => {
    const { minutes } = (await ctx.body.json()) as { minutes?: number };
    if (!minutes) return errorResponse("invalid_minutes", 400);
    return mutate("dnd.setSnooze", { num_minutes: String(minutes) }, ctx);
  }),

  route("DELETE", "/api/dnd/snooze", (ctx) => mutate("dnd.endSnooze", {}, ctx)),
];
