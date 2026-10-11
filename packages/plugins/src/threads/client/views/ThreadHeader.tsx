import { service, usePoint } from "@slock/core/solid";
import { IconButton, PanelHeader } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { openConversationInSplit } from "../../../conversations/client/api/nav";
import { SplitNavigation } from "../../../shell/client/api/SplitNavigation";

const viewStore = service("shell.view");
const messageLinks = service("message-links");
const dmsStore = service("dms");
const channelsStore = service("channels");
const titles = service("titles");
const messagesStore = service("messages");

export default function ThreadHeader(props: {
  channelId: string;
  hasMessages: boolean;
  paneId: string;
  threadTs: string;
}) {
  const headers = usePoint("threads.header");
  const header = createMemo(() => {
    for (const item of headers()) {
      const found = item(props.channelId);
      if (found) return found;
    }
  });
  const channelName = createMemo(() => titles.label(props.channelId));
  const isMember = () =>
    !!dmsStore.dmById(props.channelId) || channelsStore.isChannelMember(props.channelId);
  const subscribed = () => messagesStore.isThreadSubscribed(props.threadTs);

  return (
    <PanelHeader
      canClose={viewStore.canCloseTile()}
      onClose={() => viewStore.closeTile(props.paneId)}
    >
      <div class="thread-panel-header-info flex-align-center">
        <div class="thread-panel-title">{header()?.title ?? "Thread"}</div>
        <Show
          fallback={
            <SplitNavigation
              onSplit={() => openConversationInSplit(props.channelId, props.threadTs)}
            >
              <button
                aria-label={`View thread message in ${channelName()}`}
                class="thread-panel-subtitle btn-reset flex-align-center truncate"
                onClick={() => messageLinks.openChannelMessage(props.channelId, props.threadTs)}
                type="button"
              >
                {channelName()}
              </button>
            </SplitNavigation>
          }
          when={header()}
        >
          {(override) => override().subtitle()}
        </Show>
        <IconButton
          class="thread-panel-subscribe-btn icon-shift busy"
          classList={{ subscribed: subscribed() }}
          disabled={
            !(isMember() && props.hasMessages) ||
            messagesStore.isThreadSubscriptionPending(props.channelId, props.threadTs)
          }
          icon={subscribed() ? "notifications-check" : "notifications"}
          label={
            isMember()
              ? subscribed()
                ? "Unfollow thread"
                : "Get notified about new replies"
              : "Join the channel to get notified"
          }
          onClick={() => {
            if (isMember()) messagesStore.toggleThreadSubscribed(props.channelId, props.threadTs);
          }}
        />
      </div>
    </PanelHeader>
  );
}
