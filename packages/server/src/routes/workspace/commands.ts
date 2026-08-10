// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { type Route, route } from "../router.ts";

const LEADING_SLASH_RE = /^\//;

export const commandRoutes: Route[] = [
  // commands.list only returns commands installed for the current team (~73
  // for this workspace); client.appCommands' `commands` field is what the
  // real webapp's autocomplete uses instead and includes Slack's native
  // built-ins (type "core") alongside installed app/custom/service commands
  // — confirmed via a live capture, ~6600 entries here vs commands.list's 73.
  route("GET", "/api/commands", async (ctx) => {
    const data = await callSlack(
      "client.appCommands",
      { _x_reason: "app-commands-conditional-fetching" },
      ctx.creds,
    );
    if (!data.ok) {
      return slackErrorResponse(data, "client.appCommands", ctx.creds, ctx.acceptEncoding);
    }
    const raw: any[] = Array.isArray(data.commands) ? data.commands : [];
    const byName = new Map<string, { name: string; desc: string; icon: string | null }>();
    for (const c of raw) {
      if (!c?.name) continue;
      const name = c.name.replace(LEADING_SLASH_RE, "");
      if (!byName.has(name)) {
        byName.set(name, { desc: c.desc || "", icon: c.icons?.image_32 || null, name });
      }
    }
    return jsonResponse({ commands: [...byName.values()], ok: true }, ctx.creds, ctx.acceptEncoding);
  }),

  // Best-effort: there's no documented public method for dispatching a slash
  // command from a client — this mirrors the internal call the real webapp
  // makes, which we can't fully verify without live testing.
  route("POST", "/api/commands/run", async (ctx) => {
    const { channelId, command, text } = (await ctx.body.json()) as {
      channelId?: string;
      command?: string;
      text?: string;
    };
    if (!(channelId && command)) return errorResponse("invalid_command", 400);
    const data = await callSlack(
      "chat.command",
      { channel: channelId, command, text: text ?? "" },
      ctx.creds,
    );
    if (!data.ok) {
      return jsonResponse(
        { error: data.error ?? "Command not supported by this client.", ok: false },
        ctx.creds,
        ctx.acceptEncoding,
      );
    }
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),
];
