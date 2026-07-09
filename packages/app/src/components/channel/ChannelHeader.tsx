import { EmojiText } from "@slock/blockkit";
import { Icon, Menu } from "@slock/ui";
import { createEffect, createSignal, For, Show } from "solid-js";
import {
  activeView,
  canvasByChannel,
  channelById,
  channelDisplayName,
  createCanvasForCurrentChannel,
  createChannelSection,
  dmById,
  ensureCanvasChecked,
  isChannelMuted,
  isChannelNotifyAll,
  isChannelStarred,
  leaveCurrentChannel,
  markCurrentChannelRead,
  moveChannelToSection,
  openChannelCanvas,
  openMessageSearch,
  openPinnedPanel,
  openUserProfile,
  sections,
  toggleChannelStar,
  toggleMuteChannel,
  toggleNotifyAllChannel,
  userById,
} from "../../lib/store";
import "./ChannelHeader.css";

export default function ChannelHeader() {
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [starMenuOpen, setStarMenuOpen] = createSignal(false);
  const [addingSection, setAddingSection] = createSignal(false);
  const [newSectionName, setNewSectionName] = createSignal("");

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
  const starred = () => {
    const v = activeView();
    return v?.kind === "channel" && isChannelStarred(v.id);
  };
  const muted = () => {
    const v = activeView();
    return !!v && isChannelMuted(v.id);
  };
  const notifyAll = () => {
    const v = activeView();
    return !!v && isChannelNotifyAll(v.id);
  };
  const canvas = () => {
    const v = activeView();
    return v?.kind === "channel" ? canvasByChannel[v.id] : undefined;
  };
  const currentSectionId = () => {
    const v = activeView();
    if (!v) return null;
    return sections()?.find((s) => s.channelIds.includes(v.id))?.id ?? null;
  };

  const submitNewSectionFromStar = async () => {
    const name = newSectionName().trim();
    setAddingSection(false);
    setNewSectionName("");
    if (!name) return;
    const v = activeView();
    const created = await createChannelSection(name);
    if (created && v) moveChannelToSection(v.id, created.id);
    setStarMenuOpen(false);
  };

  const searchInConversation = () => {
    const v = activeView();
    if (!v) return;
    openMessageSearch("", v.kind === "channel" ? { inChannelId: v.id } : {});
  };

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
                <Icon name={starred() ? "star-filled" : "star"} size={16} />
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
              <span class="channel-header-menu-check">{starred() ? "✓" : ""}</span>
              Starred
            </button>
            <For each={sections()}>
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
                    {currentSectionId() === s.id ? "✓" : ""}
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
        <Show when={!isChannel()} fallback={<span class="channel-header-title">{title()}</span>}>
          <button
            type="button"
            class="channel-header-title channel-header-title-btn"
            onClick={viewDmUser}
          >
            {title()}
          </button>
        </Show>
        <Show when={topic()}>
          <span class="channel-header-topic">
            <EmojiText text={topic()} />
          </span>
        </Show>
        <div class="channel-header-actions">
          <Show when={isChannel() && canvas()}>
            <button
              type="button"
              class="channel-header-btn"
              title="Canvas"
              onClick={() => {
                const v = activeView();
                if (v) openChannelCanvas(v.id);
              }}
            >
              <Icon name="code-block" size={16} />
            </button>
          </Show>
          <button
            type="button"
            class="channel-header-btn"
            title="Search in conversation"
            onClick={searchInConversation}
          >
            <Icon name="search" size={16} />
          </button>
          <Show when={activeView()}>
            <Menu
              class="channel-header-more-wrap"
              panelClass="channel-header-menu"
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
              <button
                type="button"
                class="channel-header-menu-item"
                onClick={() => {
                  setMoreOpen(false);
                  const v = activeView();
                  if (v) markCurrentChannelRead(v.id);
                }}
              >
                Mark as read
              </button>
              <button
                type="button"
                class="channel-header-menu-item"
                onClick={() => {
                  setMoreOpen(false);
                  const v = activeView();
                  if (v) openPinnedPanel(v.id);
                }}
              >
                View pinned items
              </button>
              <button
                type="button"
                class="channel-header-menu-item"
                onClick={() => {
                  setMoreOpen(false);
                  const v = activeView();
                  if (v) toggleMuteChannel(v.id);
                }}
              >
                {muted() ? "Unmute channel" : "Mute channel"}
              </button>
              <button
                type="button"
                class="channel-header-menu-item"
                onClick={() => {
                  setMoreOpen(false);
                  const v = activeView();
                  if (v) toggleNotifyAllChannel(v.id);
                }}
              >
                {notifyAll() ? "Only notify me about mentions" : "Notify me about all new messages"}
              </button>
              <Show when={isChannel() && !canvas()}>
                <button
                  type="button"
                  class="channel-header-menu-item"
                  onClick={() => {
                    setMoreOpen(false);
                    const v = activeView();
                    if (v) createCanvasForCurrentChannel(v.id);
                  }}
                >
                  Create canvas
                </button>
              </Show>
              <button
                type="button"
                class="channel-header-menu-item"
                onClick={() => {
                  setMoreOpen(false);
                  const v = activeView();
                  if (v) navigator.clipboard.writeText(`${location.origin}/#${v.id}`);
                }}
              >
                {isChannel() ? "Copy link to channel" : "Copy link to conversation"}
              </button>
              <Show when={isChannel()}>
                <button
                  type="button"
                  class="channel-header-menu-item danger"
                  onClick={() => {
                    setMoreOpen(false);
                    const v = activeView();
                    if (v && confirm(`Leave #${title()}?`)) leaveCurrentChannel(v.id);
                  }}
                >
                  Leave channel
                </button>
              </Show>
            </Menu>
          </Show>
        </div>
      </div>
    </div>
  );
}
