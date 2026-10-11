import type { Services } from "@slock/core/types";
import { batch } from "solid-js";
import { viewForConversation } from "../../conversations/client/api/nav";

export function createMessageNavigation(deps: {
  openInNewPane: Services["shell.panes"]["openInNewPane"];
  setActiveView: Services["conversations"]["setActiveView"];
}) {
  function openThread(
    channelId: string,
    ts: string,
    highlightTs?: string,
    opts?: { pinned?: boolean },
  ) {
    deps.openInNewPane({ channelId, highlightTs, kind: "thread", pinned: opts?.pinned, ts });
  }

  function openChannelPeek(channelId: string, ts: string, highlightTs?: string) {
    batch(() => {
      deps.setActiveView(viewForConversation(channelId), { target: { channelId, ts } });
      openThread(channelId, ts, highlightTs);
    });
  }

  function openChannelMessage(channelId: string, ts: string, threadTs?: string) {
    if (threadTs && threadTs !== ts) openChannelPeek(channelId, threadTs, ts);
    else deps.setActiveView(viewForConversation(channelId), { target: { channelId, ts } });
  }

  return { openChannelMessage, openChannelPeek, openThread };
}
