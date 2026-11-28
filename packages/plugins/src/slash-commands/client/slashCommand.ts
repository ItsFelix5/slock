import { defined, errorMessage } from "@slock/core";
import type { ChannelId, Ts } from "@slock/types";
import { composerFeedbackKey, SLASH_COMMAND_RE } from "./api";

interface SlashCommandDeps {
  run: (channelId: ChannelId, command: string, text: string) => Promise<string | null>;
  flashError: (key: string, message: string) => void;
}

export async function handleSlashCommand(
  deps: SlashCommandDeps,
  channelId: ChannelId,
  threadTs: Ts | undefined,
  input: string,
): Promise<{ handled: boolean; succeeded: boolean }> {
  const match = SLASH_COMMAND_RE.exec(input);
  if (!match) return { handled: false, succeeded: false };
  const [, command, rest] = match;
  const error = await deps
    .run(channelId, `/${command}`, defined(rest))
    .catch((cause) => errorMessage(cause, "Command failed."));
  if (error) deps.flashError(composerFeedbackKey(threadTs ?? channelId), error);
  return { handled: true, succeeded: !error };
}
