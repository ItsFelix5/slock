import { defined, errorMessage } from "@slock/core";
import { composerFeedbackKey, SLASH_COMMAND_RE } from "./api";

export interface SlashCommandDeps {
  run: (channelId: string, command: string, text: string) => Promise<string | null>;
  flashError: (key: string, message: string) => void;
}

export async function handleSlashCommand(
  deps: SlashCommandDeps,
  channelId: string,
  threadTs: string | undefined,
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
