import { Slot, service } from "@slock/core/solid";
import { usePaneView } from "@slock/plugins/conversations/client/api/paneView";
import type { View } from "@slock/plugins/conversations/client/api/types";
import { Button, Icon } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import InPaneSearchBar from "../api/pane/InPaneSearchBar";
import { createInPaneSearch } from "../api/pane/inPaneSearch";
import "./MessageList.css";
import { createMessageFocus } from "../api/messageFocus";
import MessageRows from "../api/pane/MessageRows";
import { createSystemMessageGrouper } from "../lib/groupSystemMessages";
import { createMessageListScroll } from "../messageListScroll";
import MessageListDateNav from "./parts/MessageListDateNav";

const bootstrapStore = service("bootstrap");
const messageLinks = service("message-links");
const titles = service("titles");
const messagesStore = service("messages");

export default function MessageList(props: { active: () => boolean; view: View }) {
  const { clearMessageTarget, messageTarget, paneId } = usePaneView();
  const channelId = () => props.view.id;

  const groupSystemMessages = createSystemMessageGrouper();
  const messages = createMemo(() =>
    groupSystemMessages(messagesStore.messagesInChannel(channelId()) ?? []),
  );

  const {
    feed,
    isLoadingNewer,
    jumpToBeginning,
    jumpToDate,
    jumpToMessage,
    loadNewerMessages,
    visibleDay,
  } = createMessageListScroll({
    clearMessageTarget,
    messages,
    messageTarget,
    paneView: () => (props.active() ? props.view : null),
  });

  const messageFocus = createMessageFocus(messages, feed, channelId, {
    active: props.active,
    paneId,
    onOpenThread: (ts, opts) => messageLinks.openThread(channelId(), ts, ts, opts),
  });
  const inPaneSearch = createInPaneSearch(messages, feed, () => paneId, props.active);
  const pending = () => !feed.ready() && messages().length > 0;

  return (
    <div
      aria-hidden={pending() ? "true" : "false"}
      class={["message-list", { "message-list-pending": pending() }]}
      onFocusIn={messageFocus.onContainerFocusIn}
      onFocusOut={messageFocus.onContainerFocusOut}
      ref={feed.attach}
    >
      <Show when={inPaneSearch.open()}>
        <InPaneSearchBar
          matchCount={inPaneSearch.matchCount()}
          matchIndex={inPaneSearch.matchIndex()}
          onClose={inPaneSearch.close}
          onNext={inPaneSearch.goNext}
          onPrev={inPaneSearch.goPrev}
          onQueryInput={inPaneSearch.setQuery}
          query={inPaneSearch.query()}
        />
      </Show>
      <Show when={bootstrapStore.bootstrap().status !== "loading"}>
        <Show when={visibleDay()}>
          {(day) => (
            <MessageListDateNav
              day={day()}
              onJumpToBeginning={jumpToBeginning}
              onJumpToDate={jumpToDate}
            />
          )}
        </Show>
        <Show
          fallback={
            <div class="message-list-intro message-list-error flex-col gap-sm">
              <div class="message-list-intro-icon flex-center">
                <Icon name="warning" size={26} />
              </div>
              <h2>Couldn't load this conversation</h2>
              <p>Check your connection or access, then try again.</p>
              <Button onClick={() => messagesStore.loadRecentHistory(channelId())} size="sm">
                Try again
              </Button>
            </div>
          }
          when={!(messagesStore.hasHistoryError(channelId()) && messages().length === 0)}
        >
          <Show when={messagesStore.hasHistoryError(channelId()) && messages().length > 0}>
            <div class="message-list-load-error flex-center">
              <span>Couldn't refresh this conversation.</span>
              <Button onClick={() => messagesStore.loadRecentHistory(channelId())} size="sm">
                Try again
              </Button>
            </div>
          </Show>
          <Show when={messagesStore.hasOlderHistoryError(channelId())}>
            <div class="message-list-load-error flex-center">
              <span>Couldn't load older messages.</span>
              <Button onClick={() => void messagesStore.loadOlderMessages(channelId())} size="sm">
                Try again
              </Button>
            </div>
          </Show>
          <Show
            when={
              messagesStore.hasMoreHistory(channelId()) &&
              messagesStore.isLoadingHistory(channelId())
            }
          >
            <div class="message-list-loading-older">Loading messages…</div>
          </Show>
          <Show when={!messagesStore.hasMoreHistory(channelId())}>
            <Show
              fallback={<Slot id={channelId()} kind={props.view.kind} point="messages.intro" />}
              when={props.view.kind === "channel"}
            >
              <div class="message-list-intro">
                <div class="message-list-intro-icon flex-center">#</div>
                <h2 class="truncate">{titles.title(channelId())}</h2>
              </div>
            </Show>
          </Show>
        </Show>
        <MessageRows
          channelId={channelId()}
          editingTs={messageFocus.editingTs}
          focusedTs={messageFocus.focusedTs}
          messages={messages()}
          moreMenuTs={messageFocus.moreMenuTs}
          onJumpToMessage={jumpToMessage}
          onOpenThread={(ts, opts) => messageLinks.openThread(channelId(), ts, ts, opts)}
          onStartEdit={messageFocus.onStartEdit}
          onStopEdit={messageFocus.onStopEdit}
          onToggleMoreMenu={messageFocus.onToggleMoreMenu}
          onToggleReactionPicker={messageFocus.onToggleReactionPicker}
          reactionPickerTs={messageFocus.reactionPickerTs}
        />
        <Show when={messagesStore.hasNewerHistoryError(channelId())}>
          <div class="message-list-load-error flex-center">
            <span>Couldn't load newer messages.</span>
            <Button onClick={() => void loadNewerMessages(channelId())} size="sm">
              Try again
            </Button>
          </div>
        </Show>
        <Show when={isLoadingNewer()}>
          <div aria-live="polite" class="message-list-loading-older">
            Loading messages…
          </div>
        </Show>
      </Show>
    </div>
  );
}
