import { addReminder, runSlashCommand, setChannelTopic } from "@slock/slack-api";
import { actionFeedback, composerFeedbackKey } from "../feedback";

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
  ): Promise<{ handled: boolean; succeeded: boolean }> {
    const match = input.match(/^\/(\S+)\s*(.*)$/s);
    if (!match) return { handled: false, succeeded: false };
    const [, command, rest] = match;
    const key = composerFeedbackKey(threadTs ?? channelId);

    switch (command) {
      case "shrug":
        await deps.sendMessage(channelId, rest ? `${rest} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯", threadTs);
        return { handled: true, succeeded: true };
      case "me":
        if (!rest.trim()) {
          actionFeedback.flash(key, "Add an action after /me.", "error");
          return { handled: true, succeeded: false };
        }
        await deps.sendMessage(channelId, rest, threadTs);
        return { handled: true, succeeded: true };
      case "topic":
        if (!rest.trim()) {
          actionFeedback.flash(key, "Add a topic after /topic.", "error");
          return { handled: true, succeeded: false };
        }
        try {
          await setChannelTopic(channelId, rest.trim());
          actionFeedback.flash(key, "Topic updated.");
          return { handled: true, succeeded: true };
        } catch (err) {
          actionFeedback.flash(
            key,
            err instanceof Error ? err.message : "Failed to set topic.",
            "error",
          );
          return { handled: true, succeeded: false };
        }
      case "remind":
        if (!rest.trim()) {
          actionFeedback.flash(key, "Add reminder text after /remind.", "error");
          return { handled: true, succeeded: false };
        }
        try {
          await addReminder(rest.trim(), "in 20 minutes");
          actionFeedback.flash(key, "I'll remind you.");
          return { handled: true, succeeded: true };
        } catch (err) {
          actionFeedback.flash(
            key,
            err instanceof Error ? err.message : "Failed to set reminder.",
            "error",
          );
          return { handled: true, succeeded: false };
        }
      default: {
        const error = await runSlashCommand(channelId, `/${command}`, rest);
        if (error) actionFeedback.flash(key, error, "error");
        return { handled: true, succeeded: !error };
      }
    }
  }

  return { handleSlashCommand };
}
