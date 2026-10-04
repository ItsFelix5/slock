import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import type { AppCommandsReply } from "../../slackReplies.ts";
import { type Route, route } from "../router.ts";

export const commandRoutes: Route[] = [
  route("GET", "commands", async (ctx) => {
    const data = await callSlack<AppCommandsReply>("client.appCommands", {}, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "client.appCommands", ctx.creds, ctx.acceptEncoding);
    }
    const byName = new Map<string, { name: string; desc: string; icon: string | null }>();
    for (const c of data.commands ?? []) {
      if (!c.name) continue;
      const name = c.name.startsWith("/") ? c.name.slice(1) : c.name;
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

  route("POST", "commands/run", async (ctx) => {
    const { channelId, command, text } = await ctx.body.json<{
      channelId?: string;
      command?: string;
      text?: string;
    }>();
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
