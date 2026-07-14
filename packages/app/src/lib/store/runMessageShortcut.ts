import type { MessageShortcut } from "@slock/slack-api";
import { runMessageShortcut } from "@slock/slack-api";
import { actionFeedback } from "./slices/feedback";

export function createRunMessageShortcut() {
  return async function runMessageShortcutAt(
    channelId: string,
    ts: string,
    shortcut: Pick<MessageShortcut, "actionId" | "appId" | "appName">,
  ) {
    try {
      await runMessageShortcut(shortcut.actionId, shortcut.appId, channelId, ts);
    } catch (err) {
      actionFeedback.flash(
        ts,
        err instanceof Error ? err.message : `Failed to run ${shortcut.appName}.`,
        "error",
      );
    }
  };
}
