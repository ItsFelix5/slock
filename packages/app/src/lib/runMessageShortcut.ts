import type { MessageShortcut } from "./api";
import { runMessageShortcut } from "./api";
import { actionFeedback } from "./feedback";

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
