import type { RealtimeEventHook } from "@slock/plugins/realtime/server/api";
import { trimMessage } from "@slock/plugins/slack/server/api/trim/slackMessages";
import { isChannelId, isRawMessage } from "@slock/slack";
import { keepAssets } from "./files";
import type { LogStore } from "./store";
import { workspaceOf } from "./workspace";

export function captureDeleted(store: LogStore): RealtimeEventHook {
  return {
    handle(event, creds) {
      const { channel, previous_message: previous, subtype } = event;
      if (subtype !== "message_deleted" || typeof channel !== "string" || !isChannelId(channel))
        return;
      if (!(previous && typeof previous === "object" && isRawMessage(previous))) return;
      const message = trimMessage(previous);
      store.saveMessage(workspaceOf(creds), channel, message);
      void keepAssets(message, creds, store);
    },
    types: ["message"],
  };
}
