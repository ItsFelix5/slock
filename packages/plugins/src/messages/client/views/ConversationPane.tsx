import { Slot, service, usePoint } from "@slock/core/solid";
import type { Pane } from "@slock/ui";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { PaneViewProvider } from "../../../conversations/client/api/paneView";
import type { View } from "../../../conversations/client/api/types";
import "./ConversationPane.css";
import JoinChannelBar from "../api/pane/JoinChannelBar";
import ChannelHeader from "./channel/ChannelHeader";
import { createChannelHeaderState } from "./channel/channelHeaderState";
import MessageList from "./MessageList";

const conversationsStore = service("conversations");
const channelsStore = service("channels");

function ArchivedChannelBar() {
  return (
    <div class="channel-notice-bar flex-align-center">
      <Icon name="archive" size={14} />
      <div class="channel-notice-bar-text truncate">
        This channel has been archived. You can still view its history, but new messages can't be
        sent.
      </div>
    </div>
  );
}

export default function ConversationPane(props: { pane: Pane<View> }) {
  const { isArchivedChannel } = createChannelHeaderState(() => props.pane.content);
  const joinableChannelId = () => {
    const view = props.pane.content;
    return view.kind === "channel" && !channelsStore.isChannelMember(view.id) ? view.id : undefined;
  };
  const takeovers = usePoint("messages.takeover");
  const takeover = () => takeovers().find((item) => item.active(props.pane.content));

  return (
    <PaneViewProvider
      value={{
        clearMessageTarget: () => conversationsStore.clearMessageTarget(props.pane.id),
        messageTarget: () => conversationsStore.messageTarget(props.pane.id),
        paneId: props.pane.id,
        view: () => props.pane.content,
      }}
    >
      <div class="conversation-pane flex-col" data-pane={props.pane.id}>
        <ChannelHeader />
        <Show
          fallback={
            <Show when={takeover()}>
              {(item) => <Dynamic component={item().view} {...props.pane.content} />}
            </Show>
          }
          when={!takeover()}
        >
          <MessageList />
          <Show
            fallback={
              <Show
                fallback={
                  <div class="typing-indicator-anchor composer-overlay">
                    <Slot channelId={props.pane.content.id} point="messages.footer" />
                    <Show keyed when={props.pane.content}>
                      {(content) => (
                        <Slot
                          channelId={content.id}
                          paneId={props.pane.id}
                          point="composer.input"
                        />
                      )}
                    </Show>
                  </div>
                }
                when={isArchivedChannel()}
              >
                <ArchivedChannelBar />
              </Show>
            }
            when={joinableChannelId()}
          >
            {(channelId) => <JoinChannelBar channelId={channelId()} />}
          </Show>
        </Show>
      </div>
    </PaneViewProvider>
  );
}
