import { service } from "@slock/core/solid";
import { runSlashCommand } from "../../slack/client/api";
import { handleSlashCommand } from "./slashCommand";

const feedback = service("feedback");

export function createSlashCommandsStore() {
  const deps = {
    flashError: (key: string, message: string) => feedback.flash(key, message, "error"),
    run: runSlashCommand,
  };
  return {
    handleSlashCommand: (channelId: string, threadTs: string | undefined, input: string) =>
      handleSlashCommand(deps, channelId, threadTs, input),
  };
}
