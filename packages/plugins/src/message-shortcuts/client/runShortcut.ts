import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import { runMessageShortcut } from "@slock/plugins/slack/client/api";
import type { ChannelId, MessageShortcut, Ts } from "@slock/types";

const feedback = service("feedback");

export async function runShortcut(
  channelId: ChannelId,
  ts: Ts,
  shortcut: Pick<MessageShortcut, "actionId" | "appId" | "appName">,
) {
  try {
    await runMessageShortcut(shortcut.actionId, shortcut.appId, channelId, ts);
  } catch (err) {
    feedback.flash(ts, errorMessage(err, `Failed to run ${shortcut.appName}.`), "error");
  }
}
