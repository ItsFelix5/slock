import { service } from "@slock/core/solid";
import type { MessageShortcut } from "@slock/types";
import { runMessageShortcut } from "../../slack/client/api";

const feedback = service("feedback");

export async function runShortcut(
  channelId: string,
  ts: string,
  shortcut: Pick<MessageShortcut, "actionId" | "appId" | "appName">,
) {
  try {
    await runMessageShortcut(shortcut.actionId, shortcut.appId, channelId, ts);
  } catch (err) {
    feedback.flash(
      ts,
      err instanceof Error ? err.message : `Failed to run ${shortcut.appName}.`,
      "error",
    );
  }
}
