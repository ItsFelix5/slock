import { Slot, service, usePoint } from "@slock/core/solid";
import type { Pane } from "@slock/ui";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { PaneViewProvider } from "../../../conversations/client/api/paneView";
import type { View } from "../../../conversations/client/api/types";
import "./ConversationPane.css";
import ComposerGate from "../api/pane/ComposerGate";
import ChannelHeader from "./channel/ChannelHeader";
import MessageList from "./MessageList";

const conversationsStore = service("conversations");

export default function ConversationPane(props: { pane: Pane<View> }) {
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
          <div class="typing-indicator-anchor composer-overlay">
            <Slot channelId={props.pane.content.id} point="messages.footer" />
            <ComposerGate channelId={props.pane.content.id}>
              <Show keyed when={props.pane.content}>
                {(content) => (
                  <Slot channelId={content.id} paneId={props.pane.id} point="composer.input" />
                )}
              </Show>
            </ComposerGate>
          </div>
        </Show>
      </div>
    </PaneViewProvider>
  );
}
