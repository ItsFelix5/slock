import { Slot, service } from "@slock/core/solid";
import { Button, Icon } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { usePaneView } from "../../../conversations/client/api/paneView";
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

export default function MessageList() {
  const { clearMessageTarget, messageTarget, paneId, view: paneView } = usePaneView();

  const groupSystemMessages = createSystemMessageGrouper();
  const messages = createMemo(() => {
    const v = paneView();
    if (!v) return [];
    return groupSystemMessages(messagesStore.messagesInChannel(v.id) ?? []);
  });
  const activeChannelId = () => paneView()?.id;

  const {
    feed,
    isLoadingNewer,
    jumpToBeginning,
    jumpToDate,
    jumpToMessage,
    loadNewerMessages,
    visibleDay,
  } = createMessageListScroll({ clearMessageTarget, messages, messageTarget, paneView });

  const messageFocus = createMessageFocus(messages, feed, activeChannelId, {
    paneId,
    onOpenThread: (ts, opts) => {
      const v = paneView();
      if (v) messageLinks.openThread(v.id, ts, ts, opts);
    },
  });
  const inPaneSearch = createInPaneSearch(messages, feed, () => paneId);
  const pending = () => !feed.ready() && messages().length > 0;

  const channelName = createMemo(() => {
    const v = paneView();
    return v ? titles.title(v.id) : "";
  });

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
        <Show when={paneView()}>
          {(v) => (
            <>
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
                    <Button onClick={() => messagesStore.loadRecentHistory(v().id)} size="sm">
                      Try again
                    </Button>
                  </div>
                }
                when={!(messagesStore.hasHistoryError(v().id) && messages().length === 0)}
              >
                <Show when={messagesStore.hasHistoryError(v().id) && messages().length > 0}>
                  <div class="message-list-load-error flex-center">
                    <span>Couldn't refresh this conversation.</span>
                    <Button onClick={() => messagesStore.loadRecentHistory(v().id)} size="sm">
                      Try again
                    </Button>
                  </div>
                </Show>
                <Show when={messagesStore.hasOlderHistoryError(v().id)}>
                  <div class="message-list-load-error flex-center">
                    <span>Couldn't load older messages.</span>
                    <Button onClick={() => void messagesStore.loadOlderMessages(v().id)} size="sm">
                      Try again
                    </Button>
                  </div>
                </Show>
                <Show
                  when={
                    messagesStore.hasMoreHistory(v().id) && messagesStore.isLoadingHistory(v().id)
                  }
                >
                  <div class="message-list-loading-older">Loading messages…</div>
                </Show>
                <Show when={!messagesStore.hasMoreHistory(v().id)}>
                  <Show
                    fallback={<Slot id={v().id} kind={v().kind} point="messages.intro" />}
                    when={v().kind === "channel"}
                  >
                    <div class="message-list-intro">
                      <div class="message-list-intro-icon flex-center">#</div>
                      <h2 class="truncate">{channelName()}</h2>
                    </div>
                  </Show>
                </Show>
              </Show>
              <MessageRows
                channelId={v().id}
                editingTs={messageFocus.editingTs}
                focusedTs={messageFocus.focusedTs}
                messages={messages()}
                moreMenuTs={messageFocus.moreMenuTs}
                onJumpToMessage={jumpToMessage}
                onOpenThread={(ts, opts) => messageLinks.openThread(v().id, ts, ts, opts)}
                onStartEdit={messageFocus.onStartEdit}
                onStopEdit={messageFocus.onStopEdit}
                onToggleMoreMenu={messageFocus.onToggleMoreMenu}
                onToggleReactionPicker={messageFocus.onToggleReactionPicker}
                reactionPickerTs={messageFocus.reactionPickerTs}
              />
              <Show when={messagesStore.hasNewerHistoryError(v().id)}>
                <div class="message-list-load-error flex-center">
                  <span>Couldn't load newer messages.</span>
                  <Button onClick={() => void loadNewerMessages(v().id)} size="sm">
                    Try again
                  </Button>
                </div>
              </Show>
              <Show when={isLoadingNewer()}>
                <div aria-live="polite" class="message-list-loading-older">
                  Loading messages…
                </div>
              </Show>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
