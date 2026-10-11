import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import { runSlashCommand } from "../../slack/client/api";
import { composerFeedbackKey } from "./api";

const feedback = service("feedback");

const SLASH_COMMAND_RE = /^\/(\S+)\s*(.*)$/s;

export function createSlashCommandsStore() {
  async function handleSlashCommand(
    channelId: string,
    threadTs: string | undefined,
    input: string,
  ): Promise<{ handled: boolean; succeeded: boolean }> {
    const match = SLASH_COMMAND_RE.exec(input);
    if (!match) return { handled: false, succeeded: false };
    const [, command, rest] = match;
    const key = composerFeedbackKey(threadTs ?? channelId);

    const error = await runSlashCommand(channelId, `/${command}`, defined(rest));
    if (error) feedback.flash(key, error, "error");
    return { handled: true, succeeded: !error };
  }

  return { handleSlashCommand };
}
