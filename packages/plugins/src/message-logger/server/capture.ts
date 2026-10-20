import { isRawMessage } from "@slock/slack";
import type { RealtimeEventHook } from "../../realtime/server/api";
import { trimMessage } from "../../slack/server/api/trim/slackMessages";
import { keepAssets } from "./files";
import type { LogStore } from "./store";
import { workspaceOf } from "./workspace";

export function captureDeleted(store: LogStore): RealtimeEventHook {
  return {
    handle(event, creds) {
      const { channel, previous_message: previous, subtype } = event;
      if (subtype !== "message_deleted" || typeof channel !== "string") return;
      if (!(previous && typeof previous === "object" && isRawMessage(previous))) return;
      const message = trimMessage(previous);
      store.saveMessage(workspaceOf(creds), channel, message);
      void keepAssets(message, creds, store);
    },
    types: ["message"],
  };
}
