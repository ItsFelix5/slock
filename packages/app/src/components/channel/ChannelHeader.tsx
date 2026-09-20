import { EmojiFreezeContext, Mrkdwn } from "@slock/blockkit";
import { Icon, IconButton, InlineFeedback, Menu, MenuItem, Tooltip } from "@slock/ui";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { channelIconName } from "../../lib/displayName";
import { actionFeedback } from "../../lib/feedback";
import { usePaneView } from "../../lib/paneView";
import { store } from "../../lib/store";
import ChannelActionsMenuItems from "./ChannelActionsMenuItems";
import "./ChannelHeader.css";
import ChannelMoveMenu from "./ChannelMoveMenu";
import { createChannelHeaderState } from "./channelHeaderState";
import { openChannelDetails } from "./lib/channelDetails";

export default function ChannelHeader() {
  const { paneId, view } = usePaneView();
  const {
    channelMemberCount,
    channelTitle,
    channelTopic,
    filesLinksOpen,
    isArchivedChannel,
    isChannelView,
    isPrivateChannel,
    openCurrentDmProfile,
    searchCurrentConversation,
  } = createChannelHeaderState(view, paneId);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [canvasMenuOpen, setCanvasMenuOpen] = createSignal(false);
  const [topicEl, setTopicEl] = createSignal<HTMLSpanElement>();
  const [topicOverflowing, setTopicOverflowing] = createSignal(false);
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
  const activeChannelId = () => {
    const v = view();
    return v?.kind === "channel" ? v.id : undefined;
  };
  const canvases = () => {
    const channelId = activeChannelId();
    return channelId ? store.canvas.canvasesFor(channelId) : [];
  };
  let lastCanvasChannelId: string | undefined;
  createEffect(() => {
    const channelId = activeChannelId();
    if (channelId !== lastCanvasChannelId) setCanvasMenuOpen(false);
    lastCanvasChannelId = channelId;
  });
  return (
    <div class="channel-header flex-align-center">
      <div class="channel-header-context flex-align-center">
        <div class="flex-align-center">
          <Show when={isChannelView() && view()?.id}>
            {(id) => <ChannelMoveMenu channelId={id()} channelTitle={channelTitle()} />}
          </Show>
          <button
            class="channel-header-title channel-header-title-btn btn-reset"
            onClick={() => {
              const v = view();
              if (!v) return;
              if (v.kind === "channel") openChannelDetails(v.id);
              else openCurrentDmProfile();
            }}
            type="button"
          >
            <Show fallback={null} when={view()?.kind !== "dm"}>
              <Icon
                class="channel-header-icon"
                name={channelIconName(isPrivateChannel())}
                size={16}
              />
            </Show>
            <span class="truncate">{channelTitle()}</span>
          </button>
          <Show when={isArchivedChannel()}>
            <span class="channel-header-archived-badge">Archived</span>
          </Show>
        </div>
        <span
          class="channel-header-topic-wrap"
          classList={{ "is-overflowing": topicOverflowing() }}
          hidden={!channelTopic()}
          tabIndex={topicOverflowing() ? 0 : undefined}
        >
          <EmojiFreezeContext.Provider value="hover">
            <span class="channel-header-topic truncate text-dim text-sm" ref={setTopicEl}>
              <Mrkdwn text={channelTopic()} />
            </span>
            <span class="channel-header-topic-tooltip text-dim text-sm">
              <Mrkdwn text={channelTopic()} />
            </span>
          </EmojiFreezeContext.Provider>
        </span>
        <Show when={view()?.id}>
          {(id) => (
            <InlineFeedback class="channel-header-feedback" feedback={actionFeedback.get(id())} />
          )}
        </Show>
      </div>
      <div class="channel-header-actions">
        <Show when={canvases().length > 0}>
          <Menu
            align="end"
            class="channel-header-canvas-wrap"
            onClose={() => setCanvasMenuOpen(false)}
            open={canvasMenuOpen()}
            panelClass="menu-panel channel-header-canvas-menu"
            trigger={
              <IconButton
                class="channel-header-btn"
                icon="canvas-browser"
                onClick={() => setCanvasMenuOpen(!canvasMenuOpen())}
                size="md"
              />
            }
          >
            <For each={canvases()}>
              {(canvas) => (
                <MenuItem
                  icon="canvas-content"
                  onClick={() => {
                    setCanvasMenuOpen(false);
                    store.canvas.openCanvasPane(canvas.fileId, canvas.title);
                  }}
                >
                  <span class="truncate">
                    <Mrkdwn text={canvas.title || "Untitled canvas"} />
                  </span>
                </MenuItem>
              )}
            </For>
          </Menu>
        </Show>
        <Show when={isChannelView() && channelMemberCount()}>
          {(count) => (
            <Tooltip content="View members">
              <button
                class="channel-header-members-btn btn-reset icon-btn icon-action"
                onClick={() => {
                  const v = view();
                  if (v?.kind === "channel") openChannelDetails(v.id, "members");
                }}
                type="button"
              >
                <Icon name="user-groups" size={16} />
                <span>{count()}</span>
              </button>
            </Tooltip>
          )}
        </Show>
        <IconButton
          active={filesLinksOpen()}
          class="channel-header-btn"
          icon="search"
          onClick={searchCurrentConversation}
          size="md"
        />
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
              <ChannelActionsMenuItems
                channelId={v().id}
                channelTitle={channelTitle()}
                isDm={v().kind === "dm"}
                onClose={() => setMoreOpen(false)}
              />
            </Menu>
          )}
        </Show>
        <Show when={store.viewState.canCloseTile()}>
          <IconButton
            class="channel-header-btn"
            icon="close"
            onClick={() => store.viewState.closeTile(paneId)}
            size="md"
          />
        </Show>
      </div>
    </div>
  );
}
