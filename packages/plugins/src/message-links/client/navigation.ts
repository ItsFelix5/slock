import type { Services } from "@slock/core/types";
import {
  openConversationInSplit,
  viewForConversation,
} from "@slock/plugins/conversations/client/api/nav";
import type { ChannelId, Ts } from "@slock/types";

export function createMessageNavigation(deps: {
  openInNewPane: Services["shell.panes"]["openInNewPane"];
  setActiveView: Services["conversations"]["setActiveView"];
}) {
  function openThread(channelId: ChannelId, ts: Ts, highlightTs?: Ts, opts?: { pinned?: boolean }) {
    deps.openInNewPane({ channelId, highlightTs, kind: "thread", pinned: opts?.pinned, ts });
  }

  function openChannelPeek(channelId: ChannelId, ts: Ts, highlightTs?: Ts) {
    deps.setActiveView(viewForConversation(channelId), { target: { channelId, ts } });
    openThread(channelId, ts, highlightTs);
  }

  function openChannelMessage(channelId: ChannelId, ts: Ts, threadTs?: Ts) {
    if (threadTs && threadTs !== ts) openChannelPeek(channelId, threadTs, ts);
    else deps.setActiveView(viewForConversation(channelId), { target: { channelId, ts } });
  }

  function openMessageInSplit(channelId: ChannelId, ts: Ts, threadTs?: Ts) {
    if (threadTs) openThread(channelId, threadTs, ts, { pinned: true });
    else openConversationInSplit(channelId, ts);
  }

  return { openChannelMessage, openChannelPeek, openMessageInSplit, openThread };
}
