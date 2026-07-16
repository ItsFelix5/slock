import { Mrkdwn } from "@slock/blockkit";
import { Icon, InlineFeedback, Menu } from "@slock/ui";
import { createEffect, createSignal, For, Show } from "solid-js";
import { openChannelDetails } from "../../lib/channelDetails";
import { ADDABLE_CHANNEL_TABS, channelTabsFeedbackKey } from "../../lib/channelTabMeta";
import { actionFeedback, store } from "../../lib/store";
import ChannelActionsMenuItems from "./ChannelActionsMenuItems";
import {
  availableChannelTabs,
  channelTitle,
  channelTopic,
  currentSectionId,
  isChannelView,
  isPrivateChannel,
  isStarred,
  openCurrentDmProfile,
  searchCurrentConversation,
} from "./channelHeaderState";
import "./ChannelHeader.css";

export default function ChannelHeader() {
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [starMenuOpen, setStarMenuOpen] = createSignal(false);
  const [addingSection, setAddingSection] = createSignal(false);
  const [newSectionName, setNewSectionName] = createSignal("");
  const [addTabOpen, setAddTabOpen] = createSignal(false);
  createEffect(() => {
    const v = store.viewState.activeView();
    if (v?.kind === "channel") store.canvas.ensureCanvasChecked(v.id);
  });
  const submitNewSectionFromStar = async () => {
    const name = newSectionName().trim();
    setAddingSection(false);
    setNewSectionName("");
    if (!name) return;
    const v = store.viewState.activeView();
    const created = await store.channels.createChannelSection(name, v?.id ?? name);
    if (created && v) store.channels.moveChannelToSection(v.id, created.id);
    setStarMenuOpen(false);
  };
  return (
    <div class="channel-header">
      <div class="channel-header-top flex-align-center">
        <Show when={isChannelView()}>
          <Menu
            class="channel-header-star-wrap"
            onClose={() => {
              setStarMenuOpen(false);
              setAddingSection(false);
            }}
            open={starMenuOpen()}
            panelClass="channel-header-star-menu popover flex-col"
            trigger={
              <button
                class="channel-header-star btn-reset icon-btn sm icon-action text-dim"
                classList={{ active: isStarred() }}
                onClick={() => setStarMenuOpen(!starMenuOpen())}
                title="Move to…"
                type="button"
              >
                <Icon name={isStarred() ? "star-filled" : "section"} size={16} />
              </button>
            }
          >
            <div class="channel-header-star-menu-label menu-label">Move to</div>
            <button
              class="channel-header-menu-item menu-item"
              onClick={() => {
                const v = store.viewState.activeView();
                if (v) store.channels.toggleChannelStar(v.id);
              }}
              type="button"
            >
              <span class="channel-header-menu-check" style="color: var(--mention-self-text);">
                <Show when={isStarred()}>
                  <Icon name="star-filled" size={12} />
                </Show>
              </span>
              Starred
            </button>
            <For each={store.channels.sections()?.filter((s) => s.type === "standard")}>
              {(s) => (
                <button
                  class="channel-header-menu-item menu-item"
                  onClick={() => {
                    const v = store.viewState.activeView();
                    if (v)
                      store.channels.moveChannelToSection(
                        v.id,
                        currentSectionId() === s.id ? null : s.id,
                      );
                  }}
                  type="button"
                >
                  <span class="channel-header-menu-check">
                    <Show when={currentSectionId() === s.id}>
                      <Icon name="check-filled" size={12} />
                    </Show>
                  </span>
                  {s.name}
                </button>
              )}
            </For>
            <div class="channel-header-star-menu-divider divider" />
            <Show
              fallback={
                <button
                  class="channel-header-menu-item menu-item"
                  onClick={() => setAddingSection(true)}
                  type="button"
                >
                  <Icon name="plus" size={13} /> New section
                </button>
              }
              when={addingSection()}
            >
              <input
                autofocus
                class="channel-header-star-menu-input search-input"
                onBlur={submitNewSectionFromStar}
                onInput={(e) => setNewSectionName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewSectionFromStar();
                  if (e.key === "Escape") {
                    setAddingSection(false);
                    setNewSectionName("");
                  }
                }}
                placeholder="Section name"
                value={newSectionName()}
              />
            </Show>
          </Menu>
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
        <Show when={channelTopic()}>
          <span class="channel-header-topic truncate text-dim text-sm">
            <Mrkdwn text={channelTopic()} />
          </span>
        </Show>
        <Show when={store.viewState.activeView()?.id}>
          {(id) => (
            <InlineFeedback class="channel-header-feedback" feedback={actionFeedback.get(id())} />
          )}
        </Show>
        <div class="channel-header-actions">
          <button
            class="channel-header-btn btn-reset icon-btn md icon-action"
            onClick={searchCurrentConversation}
            title="Search in conversation"
            type="button"
          >
            <Icon name="search" size={16} />
          </button>
          <Show when={store.viewState.activeView()}>
            {(v) => (
              <Menu
                class="channel-header-more-wrap"
                onClose={() => setMoreOpen(false)}
                open={moreOpen()}
                panelClass="menu-panel channel-header-menu"
                trigger={
                  <button
                    class="channel-header-btn btn-reset icon-btn md icon-action"
                    onClick={() => setMoreOpen(!moreOpen())}
                    title="More"
                    type="button"
                  >
                    <Icon name="ellipsis-vertical-filled" size={16} />
                  </button>
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
      <Show when={undefined as string | undefined}>
        {(id) => (
          <div aria-label="Channel tabs" class="channel-header-tabs" role="toolbar">
            <span aria-current="true" class="channel-header-tab-current">
              <Icon name="message-filled" size={14} />
              Messages
            </span>
            <Show when={store.canvas.canvasByChannel[id()]?.fileId}>
              <button
                class="channel-header-tab-real btn-reset flex-align-center text-sm"
                onClick={() => store.canvas.openChannelCanvas(id())}
                type="button"
              >
                <Icon name="canvas-filled" size={14} />
                Canvas
              </button>
            </Show>
            <For each={store.channelTabs.tabsForChannel(id())}>
              {(type) => {
                const meta =
                  ADDABLE_CHANNEL_TABS.find((t) => t.type === type) ?? ADDABLE_CHANNEL_TABS[0];
                return (
                  <span class="channel-header-tab">
                    <button
                      class="channel-header-tab-btn btn-reset flex-align-center text-sm"
                      onClick={() => store.pinned.openPinnedPanel(id())}
                      type="button"
                    >
                      <Icon name={meta.icon} size={14} />
                      {meta.label}
                    </button>
                    <button
                      aria-label={`Remove ${meta.label} tab`}
                      class="channel-header-tab-remove btn-reset icon-btn text-dim"
                      onClick={() => store.channelTabs.removeChannelTab(id(), type)}
                      title={`Remove ${meta.label} tab`}
                      type="button"
                    >
                      <Icon name="close-filled" size={11} />
                    </button>
                  </span>
                );
              }}
            </For>
            <Show when={availableChannelTabs(id()).length > 0}>
              <Menu
                class="channel-header-tab-add-wrap"
                onClose={() => setAddTabOpen(false)}
                open={addTabOpen()}
                panelClass="channel-header-tab-add-menu popover flex-col"
                trigger={
                  <button
                    aria-label="Add a tab"
                    class="channel-header-tab-add btn-reset icon-btn text-dim"
                    onClick={() => setAddTabOpen(!addTabOpen())}
                    title="Add a tab"
                    type="button"
                  >
                    <Icon name="plus-filled" size={12} />
                  </button>
                }
              >
                <For each={availableChannelTabs(id())}>
                  {(t) => (
                    <button
                      class="channel-header-menu-item menu-item"
                      onClick={() => {
                        store.channelTabs.addChannelTab(id(), t.type);
                        setAddTabOpen(false);
                      }}
                      type="button"
                    >
                      <Icon name={t.icon} size={14} />
                      {t.label}
                    </button>
                  )}
                </For>
              </Menu>
            </Show>
            <InlineFeedback
              class="channel-header-tabs-feedback"
              feedback={actionFeedback.get(channelTabsFeedbackKey(id()))}
            />
          </div>
        )}
      </Show>
    </div>
  );
}
