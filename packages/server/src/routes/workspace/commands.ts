// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.
import { writeFile } from "node:fs/promises";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import { type Route, route } from "../router.ts";

const LEADING_SLASH_RE = /^\//;

export const commandRoutes: Route[] = [
  route("GET", "/api/commands", async (ctx) => {
    const data = await callSlack("commands.list", {}, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "commands.list", ctx.creds, ctx.acceptEncoding);
    const commandsObj = data.commands ?? {};
    // DEBUG: commands.list only returned 73 commands for the user, who says
    // client.appCommands has a `commands` field with more. Dumping just that
    // field to a file instead of console (too large to read as log lines).
    callSlack("client.appCommands", { _x_reason: "app-commands-conditional-fetching" }, ctx.creds)
      .then((appCommandsData) =>
        writeFile(
          "/tmp/debug-app-commands.json",
          JSON.stringify(appCommandsData.commands, null, 2),
        ),
      )
      .then(() => console.log("[debug] wrote /tmp/debug-app-commands.json"))
      .catch((err) => console.log("[debug client.appCommands] failed:", err));
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
