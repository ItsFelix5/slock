import { Mrkdwn } from "@slock/blockkit";
import { Icon, InlineFeedback, Menu } from "@slock/ui";
import { createEffect, createSignal, For, Show } from "solid-js";
import { openChannelDetails } from "../../lib/channelDetails";
import { ADDABLE_CHANNEL_TABS, channelTabsFeedbackKey } from "../../lib/channelTabMeta";
import {
  actionFeedback,
  activeView,
  addChannelTab,
  canvasByChannel,
  channelById,
  channelDisplayName,
  createChannelSection,
  dmById,
  ensureCanvasChecked,
  isChannelStarred,
  moveChannelToSection,
  openChannelCanvas,
  openMessageSearch,
  openPinnedPanel,
  openUserProfile,
  removeChannelTab,
  sections,
  tabsForChannel,
  toggleChannelStar,
  userById,
} from "../../lib/store";
import ChannelActionsMenuItems from "./ChannelActionsMenuItems";
import "./ChannelHeader.css";

export default function ChannelHeader() {
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [starMenuOpen, setStarMenuOpen] = createSignal(false);
  const [addingSection, setAddingSection] = createSignal(false);
  const [newSectionName, setNewSectionName] = createSignal("");
  const [addTabOpen, setAddTabOpen] = createSignal(false);

  createEffect(() => {
    const v = activeView();
    if (v?.kind === "channel") ensureCanvasChecked(v.id);
  });

  const title = () => {
    const v = activeView();
    if (!v) return "";
    if (v.kind === "channel") return channelDisplayName(channelById(v.id), v.id);
    const dm = dmById(v.id);
    return dm ? (userById(dm.userId)?.name ?? "") : "";
  };

  const topic = () => {
    const v = activeView();
    if (!v) return "";
    if (v.kind === "channel") return channelById(v.id)?.topic ?? "";
    return "Direct message";
  };

  const isPrivate = () => {
    const v = activeView();
    return v?.kind === "channel" && !!channelById(v.id)?.private;
  };

  const isChannel = () => activeView()?.kind === "channel";
  const channelId = () => {
    const v = activeView();
    return v?.kind === "channel" ? v.id : null;
  };
  const starred = () => {
    const v = activeView();
    return v?.kind === "channel" && isChannelStarred(v.id);
  };
  const currentSectionId = () => {
    const v = activeView();
    if (!v) return null;
    return (
      sections()
        ?.filter((s) => s.type === "standard")
        .find((s) => s.channelIds.includes(v.id))?.id ?? null
    );
  };

  const submitNewSectionFromStar = async () => {
    const name = newSectionName().trim();
    setAddingSection(false);
    setNewSectionName("");
    if (!name) return;
    const v = activeView();
    const created = await createChannelSection(name, v?.id ?? name);
    if (created && v) moveChannelToSection(v.id, created.id);
    setStarMenuOpen(false);
  };

  const searchInConversation = () => {
    const v = activeView();
    if (!v) return;
    openMessageSearch("", v.kind === "channel" ? { inChannelId: v.id } : {});
  };

  const availableTabs = (id: string) =>
    ADDABLE_CHANNEL_TABS.filter((t) => !tabsForChannel(id).includes(t.type));

  const viewDmUser = () => {
    const v = activeView();
    if (v?.kind !== "dm") return;
    const dm = dmById(v.id);
    if (dm) openUserProfile(dm.userId);
  };

  return (
    <div class="channel-header">
      <div class="channel-header-top">
        <Show when={isChannel()}>
          <Menu
            class="channel-header-star-wrap"
            panelClass="channel-header-star-menu"
            open={starMenuOpen()}
            onClose={() => {
              setStarMenuOpen(false);
              setAddingSection(false);
            }}
            trigger={
              <button
                type="button"
                class="channel-header-star"
                classList={{ active: starred() }}
                title="Move to…"
                onClick={() => setStarMenuOpen(!starMenuOpen())}
              >
                <Icon name={starred() ? "star-filled" : "section"} size={16} />
              </button>
            }
          >
            <div class="channel-header-star-menu-label">Move to</div>
            <button
              type="button"
              class="channel-header-menu-item"
              onClick={() => {
                const v = activeView();
                if (v) toggleChannelStar(v.id);
              }}
            >
              <span class="channel-header-menu-check" style="color: var(--mention-self-text);">
                <Show when={starred()}>
                  <Icon name="star-filled" size={12} />
                </Show>
              </span>
              Starred
            </button>
            <For each={sections()?.filter((s) => s.type === "standard")}>
              {(s) => (
                <button
                  type="button"
                  class="channel-header-menu-item"
                  onClick={() => {
                    const v = activeView();
                    if (v) moveChannelToSection(v.id, currentSectionId() === s.id ? null : s.id);
                  }}
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
            <div class="channel-header-star-menu-divider" />
            <Show
              when={addingSection()}
              fallback={
                <button
                  type="button"
                  class="channel-header-menu-item"
                  onClick={() => setAddingSection(true)}
                >
                  <Icon name="plus" size={13} /> New section
                </button>
              }
            >
              <input
                class="channel-header-star-menu-input"
                placeholder="Section name"
                value={newSectionName()}
                onInput={(e) => setNewSectionName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewSectionFromStar();
                  if (e.key === "Escape") {
                    setAddingSection(false);
                    setNewSectionName("");
                  }
                }}
                onBlur={submitNewSectionFromStar}
                autofocus
              />
            </Show>
          </Menu>
        </Show>
        <span class="channel-header-icon">
          <Show when={activeView()?.kind !== "dm"} fallback={null}>
            {isPrivate() ? <Icon name="lock" size={14} /> : "#"}
          </Show>
        </span>
        <button
          type="button"
          class="channel-header-title channel-header-title-btn"
          onClick={() => {
            const v = activeView();
            if (!v) return;
            if (v.kind === "channel") openChannelDetails(v.id);
            else viewDmUser();
          }}
        >
          {title()}
        </button>
        <Show when={topic()}>
          <span class="channel-header-topic">
            <Mrkdwn text={topic()} />
          </span>
        </Show>
        <Show when={activeView()?.id}>
          {(id) => (
            <InlineFeedback feedback={actionFeedback.get(id())} class="channel-header-feedback" />
          )}
        </Show>
        <div class="channel-header-actions">
          <button
            type="button"
            class="channel-header-btn"
            title="Search in conversation"
            onClick={searchInConversation}
          >
            <Icon name="search" size={16} />
          </button>
          <Show when={activeView()}>
            {(v) => (
              <Menu
                class="channel-header-more-wrap"
                panelClass="menu-panel channel-header-menu"
                open={moreOpen()}
                onClose={() => setMoreOpen(false)}
                trigger={
                  <button
                    type="button"
                    class="channel-header-btn"
                    title="More"
                    onClick={() => setMoreOpen(!moreOpen())}
                  >
                    <Icon name="ellipsis-vertical-filled" size={16} />
                  </button>
                }
              >
                <ChannelActionsMenuItems
                  channelId={v().id}
                  channelTitle={title()}
                  isDm={v().kind === "dm"}
                  onClose={() => setMoreOpen(false)}
                />
              </Menu>
            )}
          </Show>
        </div>
      </div>
      <Show when={channelId()}>
        {(id) => (
          <div class="channel-header-tabs" role="toolbar" aria-label="Channel tabs">
            <span class="channel-header-tab-current" aria-current="true">
              <Icon name="message-filled" size={14} />
              Messages
            </span>
            <Show when={canvasByChannel[id()]?.fileId}>
              <button
                type="button"
                class="channel-header-tab-real"
                onClick={() => openChannelCanvas(id())}
              >
                <Icon name="canvas-filled" size={14} />
                Canvas
              </button>
            </Show>
            <For each={tabsForChannel(id())}>
              {(type) => {
                const meta =
                  ADDABLE_CHANNEL_TABS.find((t) => t.type === type) ?? ADDABLE_CHANNEL_TABS[0];
                return (
                  <span class="channel-header-tab">
                    <button
                      type="button"
                      class="channel-header-tab-btn"
                      onClick={() => openPinnedPanel(id())}
                    >
                      <Icon name={meta.icon} size={14} />
                      {meta.label}
                    </button>
                    <button
                      type="button"
                      class="channel-header-tab-remove"
                      title={`Remove ${meta.label} tab`}
                      aria-label={`Remove ${meta.label} tab`}
                      onClick={() => removeChannelTab(id(), type)}
                    >
                      <Icon name="close-filled" size={11} />
                    </button>
                  </span>
                );
              }}
            </For>
            <Show when={availableTabs(id()).length > 0}>
              <Menu
                class="channel-header-tab-add-wrap"
                panelClass="channel-header-tab-add-menu"
                open={addTabOpen()}
                onClose={() => setAddTabOpen(false)}
                trigger={
                  <button
                    type="button"
                    class="channel-header-tab-add"
                    title="Add a tab"
                    aria-label="Add a tab"
                    onClick={() => setAddTabOpen(!addTabOpen())}
                  >
                    <Icon name="plus-filled" size={12} />
                  </button>
                }
              >
                <For each={availableTabs(id())}>
                  {(t) => (
                    <button
                      type="button"
                      class="channel-header-menu-item"
                      onClick={() => {
                        addChannelTab(id(), t.type);
                        setAddTabOpen(false);
                      }}
                    >
                      <Icon name={t.icon} size={14} />
                      {t.label}
                    </button>
                  )}
                </For>
              </Menu>
            </Show>
            <InlineFeedback
              feedback={actionFeedback.get(channelTabsFeedbackKey(id()))}
              class="channel-header-tabs-feedback"
            />
          </div>
        )}
      </Show>
    </div>
  );
}
