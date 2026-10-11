import { EmojiFreezeContext, Mrkdwn } from "@slock/blockkit";
import { Slot, service, usePoint } from "@slock/core/solid";
import { Icon, IconButton, InlineFeedback, Menu } from "@slock/ui";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { channelIconName } from "../../../../channels/client/api";
import { usePaneView } from "../../../../conversations/client/api/paneView";
import "./ChannelHeader.css";
import { createChannelHeaderState } from "./channelHeaderState";

const feedback = service("feedback");

const viewStore = service("shell.view");

export default function ChannelHeader() {
  const { paneId, view } = usePaneView();
  const titleOpeners = usePoint("messages.titleOpen");
  const { channelTitle, channelTopic, isArchivedChannel, isPrivateChannel } =
    createChannelHeaderState(view);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [topicEl, setTopicEl] = createSignal<HTMLSpanElement>();
  const [topicOverflowing, setTopicOverflowing] = createSignal(false);
  const [topicHovered, setTopicHovered] = createSignal(false);
  createEffect(() => {
    channelTopic();
    const el = topicEl();
    if (!el) return;
    const measure = () => setTopicOverflowing(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });
  return (
    <div class="channel-header flex-align-center">
      <div class="channel-header-context flex-align-center">
        <div class="flex-align-center">
          <Show when={view()}>
            {(v) => <Slot id={v().id} kind={v().kind} point="messages.headerLead" />}
          </Show>
          <button
            class="channel-header-title flex-align-center gap-xs channel-header-title-btn btn-reset"
            onClick={() => {
              const v = view();
              if (v) for (const open of titleOpeners()) open(v);
            }}
            type="button"
          >
            <Show fallback={null} when={view()?.kind !== "dm"}>
              <Icon
                class="channel-header-icon"
                name={channelIconName(isPrivateChannel(), isArchivedChannel())}
                size={16}
              />
            </Show>
            <span class="truncate">{channelTitle()}</span>
          </button>
        </div>
        <span
          class="channel-header-topic-wrap"
          classList={{ "is-overflowing": topicOverflowing() }}
          hidden={!channelTopic()}
          onFocusIn={() => setTopicHovered(true)}
          onFocusOut={() => setTopicHovered(false)}
          onMouseEnter={() => setTopicHovered(true)}
          onMouseLeave={() => setTopicHovered(false)}
          tabIndex={topicOverflowing() ? 0 : undefined}
        >
          <EmojiFreezeContext.Provider value={() => topicOverflowing() || !topicHovered()}>
            <span class="channel-header-topic truncate text-dim text-sm" ref={setTopicEl}>
              <Mrkdwn text={channelTopic()} />
            </span>
          </EmojiFreezeContext.Provider>
          <span class="channel-header-topic-tooltip text-dim text-sm">
            <Mrkdwn text={channelTopic()} />
          </span>
        </span>
        <Show when={view()?.id}>
          {(id) => (
            <InlineFeedback
              class="channel-header-feedback truncate"
              feedback={feedback.get(id())}
            />
          )}
        </Show>
      </div>
      <div class="channel-header-actions flex-align-center gap-xs">
        <Show when={view()}>
          {(v) => <Slot id={v().id} kind={v().kind} point="messages.header" />}
        </Show>
        <Show when={view()}>
          {(v) => (
            <Menu
              align="end"
              class="channel-header-more-wrap"
              onClose={() => setMoreOpen(false)}
              open={moreOpen()}
              panelClass="menu-panel channel-header-menu"
              trigger={
                <IconButton
                  class="channel-header-btn"
                  icon="ellipsis-vertical-filled"
                  onClick={() => setMoreOpen(!moreOpen())}
                  size="md"
                />
              }
            >
              <Slot
                channelId={v().id}
                channelTitle={channelTitle()}
                close={() => setMoreOpen(false)}
                isDm={v().kind === "dm"}
                point="messages.channelMenu"
                showMoveTo={false}
              />
            </Menu>
          )}
        </Show>
        <Show when={viewStore.canCloseTile()}>
          <IconButton
            class="channel-header-btn"
            icon="close"
            onClick={() => viewStore.closeTile(paneId)}
            size="md"
          />
        </Show>
      </div>
    </div>
  );
}
