import type { Pane } from "@slock/ui";
import { TypingIndicator } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { filesLinksChannelId } from "../../lib/filesLinksPanel";
import { PaneViewProvider } from "../../lib/paneView";
import { store } from "../../lib/store";
import type { View } from "../../lib/store/slices/types";
import ArchivedChannelBar from "../channel/ArchivedChannelBar";
import ChannelHeader from "../channel/ChannelHeader";
import { createChannelHeaderState } from "../channel/channelHeaderState";
import FilesLinksPanel from "../channel/FilesLinksPanel";
import JoinChannelBar from "../channel/JoinChannelBar";
import Composer from "../composer/Composer";
import MessageList from "../messages/MessageList";

export default function MainPane(props: { pane: Pane<View | null> }) {
  const { isArchivedChannel } = createChannelHeaderState(() => props.pane.content);
  const unjoinedChannelId = () => {
    const view = props.pane.content;
    return view?.kind === "channel" && !store.channels.isChannelMember(view.id)
      ? view.id
      : undefined;
  };
  const typingNames = createMemo(() => {
    const view = props.pane.content;
    return view ? store.typing.typingUsersInChannel(view.id).map((user) => user.name) : [];
  });
  const showFilesLinks = createMemo(() => {
    const id = props.pane.content?.id;
    return !!id && filesLinksChannelId() === id;
  });

  return (
    <PaneViewProvider
      value={{
        clearMessageTarget: () => store.panes.clearMessageTarget(props.pane.id),
        messageTarget: () => store.panes.messageTarget(props.pane.id),
        paneId: props.pane.id,
        view: () => props.pane.content,
      }}
    >
      <div class="main-panel" data-pane={props.pane.id}>
        <ChannelHeader />
        <Show fallback={<FilesLinksPanel />} when={!showFilesLinks()}>
          <MessageList />
          <Show
            fallback={
              <Show
                fallback={
                  <div class="typing-indicator-anchor">
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
            when={unjoinedChannelId()}
          >
            {(channelId) => <JoinChannelBar channelId={channelId()} />}
          </Show>
        </Show>
      </div>
    </PaneViewProvider>
  );
}
