// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { jsonResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { fetchSlack } from "../slackClient.ts";
import { type Route, route } from "./router.ts";

export const searchRoutes: Route[] = [
  // search.messages has no next-page affordance in this client — the caller
  // never requests page 2 — so unlike conversations.history/activity.feed,
  // there's no cursor to carry through here; that's intentional, not an
  // oversight.
  route("GET", "/api/search/messages", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ ok: true, results: [] }, ctx.creds, ctx.acceptEncoding);
    const sort = ctx.searchParams.get("sort") === "score" ? "score" : "timestamp";
    const sortDir = ctx.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
    const data = await fetchSlack(
      "search.messages",
      { count: "40", query, sort, sort_dir: sortDir },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "search.messages", ctx.creds, ctx.acceptEncoding);
    }
    const matches: any[] = data.messages?.matches ?? [];
    return jsonResponse(
      {
        ok: true,
        results: matches
          .filter((match) => !!(match?.channel?.id && match.ts))
          .map((match) => ({
            channelId: match.channel.id,
            channelName: match.channel.name ?? match.channel.id,
            text: match.text ?? "",
            threadTs: match.thread_ts || undefined,
            ts: match.ts,
            userId: match.user ?? "",
          })),
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

  route("GET", "/api/search/autocomplete", async (ctx) => {
    const query = ctx.searchParams.get("query")?.trim();
    if (!query) return jsonResponse({ ok: true, suggestions: [] }, ctx.creds, ctx.acceptEncoding);
    const data = await fetchSlack("search.autocomplete", { query }, ctx.creds);
    if (!data.ok) return jsonResponse({ ok: true, suggestions: [] }, ctx.creds, ctx.acceptEncoding);
    return jsonResponse(
      { ok: true, suggestions: data.suggestions?.text ?? [] },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
