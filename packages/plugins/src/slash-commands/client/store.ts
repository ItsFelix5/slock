import { service } from "@slock/core/solid";
import { apiPost } from "@slock/slack/client";
import type { ChannelId, Ts } from "@slock/types";
import { slashCommands } from "./commands";

import { handleSlashCommand } from "./slashCommand";

const feedback = service("feedback");

export function createSlashCommandsStore() {
  const deps = {
    flashError: (key: string, message: string) => feedback.flash(key, message, "error"),
    run: runSlashCommand,
  };
  return {
    available: () => slashCommands.read(null) ?? [],
    handleSlashCommand: (channelId: ChannelId, threadTs: Ts | undefined, input: string) =>
      handleSlashCommand(deps, channelId, threadTs, input),
    invalidate: () => slashCommands.invalidateAll(),
    load: () => slashCommands.ensure(null).catch(() => []),
  };
}

async function runSlashCommand(
  channelId: ChannelId,
  command: string,
  text: string,
): Promise<string | null> {
  const data = await apiPost("/api/commands/run", { channelId, command, text });
  if (!data.ok) return data.error ?? "Command not supported by this client.";
  return null;
}
