import { addReminder, runSlashCommand, setChannelTopic } from "@slock/slack-api";
import { actionFeedback } from "./feedback";

// Well-understood commands map to real documented APIs already wired up
// elsewhere in this file; anything else is forwarded best-effort to Slack's
// command dispatch, with the actual error surfaced rather than assumed to
// have worked, since that internal call can't be verified without live
// testing against a real workspace.
export function createCommandsSlice(deps: {
  sendMessage: (
    channelId: string,
    text: string,
    threadTs?: string,
    blocks?: unknown,
  ) => Promise<void>;
}) {
  async function handleSlashCommand(
    channelId: string,
    threadTs: string | undefined,
    input: string,
  ): Promise<boolean> {
    const match = input.match(/^\/(\S+)\s*(.*)$/s);
    if (!match) return false;
    const [, command, rest] = match;
    const key = threadTs ?? channelId;

    switch (command) {
      case "shrug":
        deps.sendMessage(channelId, rest ? `${rest} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯", threadTs);
        return true;
      case "me":
        deps.sendMessage(channelId, rest, threadTs);
        return true;
      case "topic":
        if (!rest.trim()) return true;
        try {
          await setChannelTopic(channelId, rest.trim());
          actionFeedback.flash(key, "Topic updated.");
        } catch (err) {
          actionFeedback.flash(
            key,
            err instanceof Error ? err.message : "Failed to set topic.",
            "error",
          );
        }
        return true;
      case "remind":
        if (!rest.trim()) return true;
        try {
          await addReminder(rest.trim(), "in 20 minutes");
          actionFeedback.flash(key, "I'll remind you.");
        } catch (err) {
          actionFeedback.flash(
            key,
            err instanceof Error ? err.message : "Failed to set reminder.",
            "error",
          );
        }
        return true;
      default: {
        const error = await runSlashCommand(channelId, `/${command}`, rest);
        if (error) actionFeedback.flash(key, error, "error");
        return true;
      }
    }
  }

  return { handleSlashCommand };
}
