import type { Pane } from "@slock/ui";
import { Icon, TypingIndicator } from "@slock/ui";
import { createEffect, createMemo, lazy, on, onCleanup, Show } from "solid-js";
import { closeFilesLinksPanel, filesLinksChannelId } from "../../lib/filesLinksPanel";
import { PaneViewProvider } from "../../lib/paneView";
import { store } from "../../lib/store";
import type { View } from "../../lib/store/slices/types";
import ChannelHeader from "../channel/ChannelHeader";
import { createChannelHeaderState } from "../channel/channelHeaderState";
import JoinChannelBar from "../channel/JoinChannelBar";
import Composer from "../composer/Composer";
import MessageList from "../messages/MessageList";

const FilesLinksPanel = lazy(() => import("../channel/FilesLinksPanel"));

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
  const { isArchivedChannel } = createChannelHeaderState(() => props.pane.content, props.pane.id);
  const joinableChannelId = () => {
    const view = props.pane.content;
    return view.kind === "channel" && !store.channels.isChannelMember(view.id)
      ? view.id
      : undefined;
  };
  const typingNames = createMemo(() =>
    store.typing.typingUsersInChannel(props.pane.content.id).map((user) => user.name),
  );
  const filesLinksOpen = () => filesLinksChannelId() === props.pane.content.id;
  createEffect(
    on(
      () => props.pane.content.id,
      (id) => onCleanup(() => filesLinksChannelId() === id && closeFilesLinksPanel()),
    ),
  );

  return (
    <PaneViewProvider
      value={{
        clearMessageTarget: () => store.panes.clearMessageTarget(props.pane.id),
        messageTarget: () => store.panes.messageTarget(props.pane.id),
        paneId: props.pane.id,
        view: () => props.pane.content,
      }}
    >
      <div class="conversation-pane flex-col" data-pane={props.pane.id}>
        <ChannelHeader />
        <Show fallback={<FilesLinksPanel />} when={!filesLinksOpen()}>
          <MessageList />
          <Show
            fallback={
              <Show
                fallback={
                  <div class="typing-indicator-anchor composer-overlay">
                    <TypingIndicator names={typingNames()} />
                    <Show keyed when={props.pane.content}>
                      {(content) => <Composer channelId={content.id} paneId={props.pane.id} />}
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
