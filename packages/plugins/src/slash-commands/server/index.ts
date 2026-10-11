import type { Setup } from "@slock/core";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { AppCommandsReply } from "../../slack/server/api/slackReplies";

const commandErrors: Record<string, string> = {
  dispatch_failed: "The app didn't respond.",
};

const list: Route[] = [
  route("GET", "commands", async (ctx) => {
    const data = await callSlack<AppCommandsReply>("client.appCommands", {}, ctx.creds);
    if (!data.ok) {
      return slackErrorResponse(data, "client.appCommands", ctx.creds);
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
    return jsonResponse({ commands: [...byName.values()], ok: true }, ctx.creds);
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
      return errorResponse(
        commandErrors[data.error ?? ""] ?? data.error ?? "Command not supported by this client.",
        502,
      );
    }
    return jsonResponse({ ok: true }, ctx.creds);
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
