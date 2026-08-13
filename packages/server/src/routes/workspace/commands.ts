import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { type Route, route } from "../router.ts";

const LEADING_SLASH_RE = /^\//;

export const commandRoutes: Route[] = [
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
        byName.set(name, {
          desc: c.desc || "",
          icon: c.icons?.image_32 || null,
          name,
        });
      }
    }
    return jsonResponse(
      { commands: [...byName.values()], ok: true },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),

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
        {
          error: data.error ?? "Command not supported by this client.",
          ok: false,
        },
        ctx.creds,
        ctx.acceptEncoding,
      );
    }
    return jsonResponse({ ok: true }, ctx.creds, ctx.acceptEncoding);
  }),
];
