// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { errorResponse, jsonResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { callSlack } from "../slackClient.ts";
import { type Route, route } from "./router.ts";

const LEADING_SLASH_RE = /^\//;

export const commandRoutes: Route[] = [
  route("GET", "/api/commands", async (ctx) => {
    const data = await callSlack("commands.list", {}, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "commands.list", ctx.creds, ctx.acceptEncoding);
    const commandsObj = data.commands ?? {};
    return jsonResponse(
      {
        commands: Object.values<any>(commandsObj)
          .filter((c) => c?.name)
          .map((c) => ({
            desc: c.desc || "",
            icon: c.icons?.image_32 || null,
            name: c.name.replace(LEADING_SLASH_RE, ""),
          })),
        ok: true,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
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
