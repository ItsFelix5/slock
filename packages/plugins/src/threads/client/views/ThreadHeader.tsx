import { service } from "@slock/core/solid";
import { openConversationInSplit } from "@slock/plugins/conversations/client/api/nav";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import type { ChannelId, Ts } from "@slock/types";
import { Button, IconButton, PanelHeader } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import type { ThreadOverride } from "../api";

const viewStore = service("shell.view");
const messageLinks = service("message-links");
const dmsStore = service("dms");
const channelsStore = service("channels");
const titles = service("titles");
const messagesStore = service("messages");

export default function ThreadHeader(props: {
  channelId: ChannelId;
  hasMessages: boolean;
  override: ThreadOverride | undefined;
  paneId: string;
  threadTs: Ts;
}) {
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
        <div class="thread-panel-title">{props.override?.title ?? "Thread"}</div>
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
          when={props.override}
        >
          {(override) => override().subtitle()}
        </Show>
        <Show when={props.override?.action?.()}>
          {(action) => (
            <Button disabled={action().disabled} onClick={action().run} size="sm">
              {action().label}
            </Button>
          )}
        </Show>
        <IconButton
          class={["thread-panel-subscribe-btn icon-shift busy", { subscribed: subscribed() }]}
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
