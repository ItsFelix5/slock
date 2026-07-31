import { Mrkdwn } from "@slock/blockkit";
import { Icon, InlineFeedback, Menu, Tooltip } from "@slock/ui";
import { createEffect, createSignal, For, Show } from "solid-js";
import { openChannelDetails } from "../../lib/channelDetails";
import { ADDABLE_CHANNEL_TABS, channelTabsFeedbackKey } from "../../lib/channelTabMeta";
import { actionFeedback, store } from "../../lib/store";
import ChannelActionsMenuItems from "./ChannelActionsMenuItems";
import "./ChannelHeader.css";
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

export default function ChannelHeader() {
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [starMenuOpen, setStarMenuOpen] = createSignal(false);
  const [addingSection, setAddingSection] = createSignal(false);
  const [newSectionName, setNewSectionName] = createSignal("");
  const [creatingSection, setCreatingSection] = createSignal(false);
  const [addTabOpen, setAddTabOpen] = createSignal(false);
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let newSectionInputRef: HTMLInputElement | undefined;
  const placementPending = () => {
    const view = store.viewState.activeView();
    return view?.kind === "channel" && store.channels.isChannelPlacementPending(view.id);
  };
  const runPlacement = async (action: (channelId: string) => Promise<boolean>) => {
    const view = store.viewState.activeView();
    if (view?.kind !== "channel") return;
    if (await action(view.id)) setStarMenuOpen(false);
  };
  createEffect(() => {
    const v = store.viewState.activeView();
    if (v?.kind === "channel") store.canvas.ensureCanvasChecked(v.id);
  });
  const submitNewSectionFromStar = async () => {
    const name = newSectionName().trim();
    if (!name || creatingSection() || store.channels.isSectionStructurePending()) return;
    const v = store.viewState.activeView();
    setCreatingSection(true);
    try {
      const created = await store.channels.createChannelSection(name, v?.id ?? name);
      if (!created) {
        queueMicrotask(() => newSectionInputRef?.focus());
        return;
      }
      if (v) await store.channels.moveChannelToSection(v.id, created.id);
      setAddingSection(false);
      setNewSectionName("");
      setStarMenuOpen(false);
    } finally {
      setCreatingSection(false);
    }
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
              <Tooltip content="Move to…">
                <button
                  aria-label="Move to…"
                  class="channel-header-star btn-reset icon-btn sm icon-action text-dim"
                  classList={{ active: isStarred() }}
                  onClick={() => setStarMenuOpen(!starMenuOpen())}
                  type="button"
                >
                  <Icon name={isStarred() ? "star-filled" : "section"} size={16} />
                </button>
              </Tooltip>
            }
          >
            <div aria-live="polite" class="channel-header-star-menu-label menu-label" role="status">
              {creatingSection() ? "Creating section…" : placementPending() ? "Moving…" : "Move to"}
            </div>
            <button
              class="channel-header-menu-item menu-item"
              disabled={placementPending() || store.channels.isSectionStructurePending()}
              onClick={() => void runPlacement(store.channels.toggleChannelStar)}
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
                  disabled={placementPending() || store.channels.isSectionStructurePending()}
                  onClick={() =>
                    void runPlacement((channelId) =>
                      store.channels.moveChannelToSection(
                        channelId,
                        currentSectionId() === s.id ? null : s.id,
                      ),
                    )
                  }
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
                  disabled={placementPending() || store.channels.isSectionStructurePending()}
                  onClick={() => setAddingSection(true)}
                  type="button"
                >
                  <Icon name="plus" size={13} /> New section
                </button>
              }
              when={addingSection()}
            >
              <input
                aria-busy={creatingSection()}
                autofocus
                class="channel-header-star-menu-input search-input"
                disabled={creatingSection()}
                onBlur={submitNewSectionFromStar}
                onInput={(e) => setNewSectionName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewSectionFromStar();
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setAddingSection(false);
                    setNewSectionName("");
                  }
                }}
                placeholder="Section name"
                ref={newSectionInputRef}
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
          <Tooltip content={channelTopic()}>
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
        <div class="channel-header-actions">
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
                    <Tooltip content={`Remove ${meta.label} tab`}>
                      <button
                        aria-label={`Remove ${meta.label} tab`}
                        class="channel-header-tab-remove btn-reset icon-btn text-dim"
                        disabled={store.channelTabs.isPending()}
                        onClick={() => store.channelTabs.removeChannelTab(id(), type)}
                        type="button"
                      >
                        <Icon name="close-filled" size={11} />
                      </button>
                    </Tooltip>
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
                  <Tooltip content="Add a tab">
                    <button
                      aria-label="Add a tab"
                      class="channel-header-tab-add btn-reset icon-btn text-dim"
                      disabled={store.channelTabs.isPending()}
                      onClick={() => setAddTabOpen(!addTabOpen())}
                      type="button"
                    >
                      <Icon name="plus-filled" size={12} />
                    </button>
                  </Tooltip>
                }
              >
                <For each={availableChannelTabs(id())}>
                  {(t) => (
                    <button
                      class="channel-header-menu-item menu-item"
                      disabled={store.channelTabs.isPending()}
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
