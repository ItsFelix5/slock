import { Mrkdwn } from "@slock/blockkit";
import { Icon, InlineFeedback, Menu, Tooltip } from "@slock/ui";
import { createEffect, createSignal, For, Show } from "solid-js";
import { openChannelDetails } from "../../lib/channelDetails";
import { actionFeedback, store } from "../../lib/store";
import ChannelActionsMenuItems from "./ChannelActionsMenuItems";
import ChannelMoveMenu from "./ChannelMoveMenu";
import "./ChannelHeader.css";
import {
  channelTitle,
  channelTopic,
  isArchivedChannel,
  isChannelView,
  isPrivateChannel,
  openCurrentDmProfile,
  searchCurrentConversation,
} from "./channelHeaderState";

export default function ChannelHeader() {
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [canvasMenuOpen, setCanvasMenuOpen] = createSignal(false);
  const activeChannelId = () => {
    const view = store.viewState.activeView();
    return view?.kind === "channel" ? view.id : undefined;
  };
  const canvases = () => {
    const channelId = activeChannelId();
    return channelId ? (store.canvas.canvasesByChannel[channelId] ?? []) : [];
  };
  let lastCanvasChannelId: string | undefined;
  createEffect(() => {
    const channelId = activeChannelId();
    if (channelId !== lastCanvasChannelId) setCanvasMenuOpen(false);
    lastCanvasChannelId = channelId;
  });
  createEffect(() => {
    const v = store.viewState.activeView();
    if (v?.kind === "channel") store.canvas.ensureCanvasChecked(v.id);
  });
  return (
    <div class="channel-header">
      <div class="channel-header-top flex-align-center">
        <div class="channel-header-context flex-align-center">
          <div class="channel-header-identity flex-align-center">
            <Show when={isChannelView() && store.viewState.activeView()?.id}>
              {(id) => <ChannelMoveMenu channelId={id()} channelTitle={channelTitle()} />}
            </Show>
            <span class="channel-header-icon">
              <Show fallback={null} when={store.viewState.activeView()?.kind !== "dm"}>
                {isPrivateChannel() ? <Icon name="lock" size={14} /> : "#"}
              </Show>
            </span>
            <button
              class="channel-header-title channel-header-title-btn btn-reset"
              onClick={() => {
                const v = store.viewState.activeView();
                if (!v) return;
                if (v.kind === "channel") openChannelDetails(v.id);
                else openCurrentDmProfile();
              }}
              type="button"
            >
              {channelTitle()}
            </button>
            <Show when={isArchivedChannel()}>
              <span class="channel-header-archived-badge">Archived</span>
            </Show>
          </div>
          <Show when={channelTopic()}>
            <Tooltip class="channel-header-topic-wrap" content={<Mrkdwn text={channelTopic()} />}>
              <span class="channel-header-topic truncate text-dim text-sm">
                <Mrkdwn text={channelTopic()} />
              </span>
            </Tooltip>
          </Show>
          <Show when={store.viewState.activeView()?.id}>
            {(id) => (
              <InlineFeedback class="channel-header-feedback" feedback={actionFeedback.get(id())} />
            )}
          </Show>
        </div>
        <div class="channel-header-actions">
          <Show when={activeChannelId() && canvases().length > 0 ? activeChannelId() : undefined}>
            {(id) => (
              <Menu
                align="end"
                class="channel-header-canvas-wrap"
                onClose={() => setCanvasMenuOpen(false)}
                onOpen={() => setCanvasMenuOpen(true)}
                open={canvasMenuOpen()}
                openOnHover
                panelClass="menu-panel channel-header-canvas-menu"
                trigger={
                  <button
                    aria-label="Canvases"
                    aria-expanded={canvasMenuOpen()}
                    class="channel-header-btn btn-reset icon-btn md icon-action"
                    onClick={() => setCanvasMenuOpen(!canvasMenuOpen())}
                    type="button"
                  >
                    <Icon name="canvas-browser" size={16} />
                  </button>
                }
              >
                <For each={canvases()}>
                  {(canvas) => (
                    <button
                      class="menu-item"
                      onClick={() => {
                        setCanvasMenuOpen(false);
                        if (canvas.fileId === store.canvas.canvasByChannel[id()]?.fileId) {
                          store.canvas.openChannelCanvas(id());
                        } else {
                          store.canvas.openFileCanvas(canvas.fileId, canvas.title);
                        }
                      }}
                      type="button"
                    >
                      <Icon name="canvas-content" size={15} />
                      <span class="truncate">
                        <Mrkdwn text={canvas.title} />
                      </span>
                    </button>
                  )}
                </For>
                <button
                  class="menu-item"
                  onClick={() => {
                    setCanvasMenuOpen(false);
                    store.canvas.openCanvasCreator(id());
                  }}
                  type="button"
                >
                  <Icon name="plus" size={15} />
                  Add canvas
                </button>
              </Menu>
            )}
          </Show>
          <Tooltip content="Search in conversation">
            <button
              aria-label="Search in conversation"
              class="channel-header-btn btn-reset icon-btn md icon-action"
              onClick={searchCurrentConversation}
              type="button"
            >
              <Icon name="search" size={16} />
            </button>
          </Tooltip>
          <Show when={store.viewState.activeView()}>
            {(v) => (
              <Menu
                align="end"
                class="channel-header-more-wrap"
                onClose={() => setMoreOpen(false)}
                open={moreOpen()}
                panelClass="menu-panel channel-header-menu"
                trigger={
                  <Tooltip content="More">
                    <button
                      aria-label="More"
                      class="channel-header-btn btn-reset icon-btn md icon-action"
                      onClick={() => setMoreOpen(!moreOpen())}
                      type="button"
                    >
                      <Icon name="ellipsis-vertical-filled" size={16} />
                    </button>
                  </Tooltip>
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
        </div>
      </div>
    </div>
  );
}
