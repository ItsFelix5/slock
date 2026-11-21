import { Slot, service, usePoint } from "@slock/core/solid";
import { PaneViewProvider } from "@slock/plugins/conversations/client/api/paneView";
import type { View } from "@slock/plugins/conversations/client/api/types";
import type { Pane } from "@slock/ui";
import { dynamic } from "@solidjs/web";
import { createMemo, For, Show } from "solid-js";
import "./ConversationPane.css";
import ComposerGate from "../api/pane/ComposerGate";
import ChannelHeader from "./channel/ChannelHeader";
import MessageList from "./MessageList";

const conversationsStore = service("conversations");

const KEPT_LISTS = 6;

function KeptMessageList(props: { active: () => boolean; view: View }) {
  const list = <MessageList active={props.active} view={props.view} />;
  return <Show when={props.active()}>{list}</Show>;
}

export default function ConversationPane(props: { pane: Pane<View> }) {
  const takeovers = usePoint("messages.takeover");
  const takeover = () => takeovers().find((item) => item.active(props.pane.content));
  const TakeoverView = dynamic(() => takeover()?.view);

  const kept = createMemo<View[]>((previous = []) => {
    const { id } = props.pane.content;
    if (takeover()) return previous;
    const current = previous.find((view) => view.id === id) ?? { ...props.pane.content };
    return [current, ...previous.filter((view) => view !== current)].slice(0, KEPT_LISTS);
  });

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
        <For each={kept()}>
          {(view) => (
            <KeptMessageList
              active={() => !takeover() && props.pane.content.id === view.id}
              view={view}
            />
          )}
        </For>
        <Show
          fallback={
            <Show when={takeover()}>
              <TakeoverView {...props.pane.content} />
            </Show>
          }
          when={!takeover()}
        >
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
