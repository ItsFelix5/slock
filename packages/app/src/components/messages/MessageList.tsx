import { Button, Icon } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { usePaneView } from "../../lib/paneView";
import { channelDisplayName, dmDisplayName, store } from "../../lib/store";
import "./MessageList.css";
import MessageRows from "./MessageRows";
import { createMessageFocus } from "./messageFocus";
import { createMessageListScroll } from "./messageListScroll";
import MessageListDateNav from "./parts/MessageListDateNav";

export default function MessageList() {
  const { clearMessageTarget, messageTarget, view: paneView } = usePaneView();

  // biome-ignore lint/suspicious/noUnassignedVariables: standard Solid ref pattern
  let scrollRef: HTMLDivElement | undefined;

  const messages = createMemo(() => {
    const v = paneView();
    if (!v) return [];
    return store.messages.messagesByChannel[v.id] ?? [];
  });
  const activeChannelId = () => paneView()?.id ?? "";
  const messageFocus = createMessageFocus(messages, () => scrollRef, activeChannelId, {
    onOpenThread: (ts, opts) => {
      const v = paneView();
      if (v) store.viewState.openThread(v.id, ts, undefined, opts);
    },
  });

  const {
    handleTouchEnd,
    handleTouchStart,
    handleWheel,
    isLoadingNewer,
    jumpToBeginning,
    jumpToDate,
    jumpToMessage,
    loadNewerMessages,
    loadOlderMessagesPreservingScroll,
    readyViewId,
    scheduleScrollCheck,
    visibleDay,
  } = createMessageListScroll({
    clearMessageTarget,
    messages,
    messageTarget,
    paneView,
    scrollRef: () => scrollRef,
  });

  const channelName = createMemo(() => {
    const v = paneView();
    if (!v) return "";
    if (v.kind === "channel") return channelDisplayName(store.channels.channelById(v.id), v.id);
    return dmDisplayName(store.dms.dmById(v.id), store.users.userById);
  });

  return (
    <div
      class="message-list"
      onFocusIn={messageFocus.onContainerFocusIn}
      onFocusOut={messageFocus.onContainerFocusOut}
      onScroll={() => scheduleScrollCheck()}
      on:touchend={{ handleEvent: handleTouchEnd, passive: true }}
      on:touchstart={{ handleEvent: handleTouchStart, passive: true }}
      on:wheel={{ handleEvent: handleWheel, passive: true }}
      ref={scrollRef}
    >
      <Show when={!store.resources.bootstrap.loading}>
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
              <div>
                <Show
                  fallback={
                    <div class="message-list-intro message-list-error">
                      <div class="message-list-intro-icon flex-center">
                        <Icon name="warning" size={26} />
                      </div>
                      <h2>Couldn't load this conversation</h2>
                      <p>Check your connection or access, then try again.</p>
                      <Button onClick={() => store.messages.loadRecentHistory(v().id)} size="sm">
                        Try again
                      </Button>
                    </div>
                  }
                  when={!(store.messages.hasHistoryError(v().id) && messages().length === 0)}
                >
                  <Show when={store.messages.hasHistoryError(v().id) && messages().length > 0}>
                    <div class="message-list-load-error">
                      <span>Couldn't refresh this conversation.</span>
                      <Button onClick={() => store.messages.loadRecentHistory(v().id)} size="sm">
                        Try again
                      </Button>
                    </div>
                  </Show>
                  <Show when={store.messages.hasOlderHistoryError(v().id)}>
                    <div class="message-list-load-error">
                      <span>Couldn't load older messages.</span>
                      <Button
                        onClick={() => void loadOlderMessagesPreservingScroll(v().id)}
                        size="sm"
                      >
                        Try again
                      </Button>
                    </div>
                  </Show>
                  <Show
                    when={
                      store.messages.hasMoreHistory(v().id) &&
                      store.messages.isLoadingHistory(v().id)
                    }
                  >
                    <div class="message-list-loading-older">Loading messages…</div>
                  </Show>
                  <Show when={!store.messages.hasMoreHistory(v().id)}>
                    <div class="message-list-intro">
                      <div class="message-list-intro-icon flex-center">#</div>
                      <h2>{channelName()}</h2>
                    </div>
                  </Show>
                </Show>
              </div>
              <div
                aria-hidden={readyViewId() !== v().id}
                classList={{ "message-list-rows-pending": readyViewId() !== v().id }}
              >
                <MessageRows
                  channelId={v().id}
                  editingTs={messageFocus.editingTs}
                  focusedTs={messageFocus.focusedTs}
                  listFocused={messageFocus.listFocused}
                  messages={messages()}
                  onJumpToMessage={jumpToMessage}
                  onOpenThread={(ts, opts) =>
                    store.viewState.openThread(v().id, ts, undefined, opts)
                  }
                  onStartEdit={messageFocus.onStartEdit}
                  onStopEdit={messageFocus.onStopEdit}
                />
                <Show when={store.messages.hasNewerHistoryError(v().id)}>
                  <div class="message-list-load-error">
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
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
