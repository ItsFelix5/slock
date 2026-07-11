import type { Channel, DirectMessage } from "@slock/slack-api";
import { Avatar, Icon, InlineFeedback, Menu, ResizeHandle, Skeleton } from "@slock/ui";
import { createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import {
  actionFeedback,
  activeView,
  bootstrap,
  channels,
  closeDmConversation,
  currentUser,
  deleteChannelSection,
  directMessages,
  hasUnreadGlow,
  hasUnreadPing,
  isChannelLeft,
  isChannelStarred,
  nav,
  openUserProfile,
  renameChannelSection,
  sections,
  setActiveView,
  setNavView,
  unreadChannelIds,
  userById,
} from "../../lib/store";
import GlobalSearch from "../search/GlobalSearch";
import Settings from "../settings/Settings";
import ActivityView from "./ActivityView";
import ChannelRow from "./ChannelRow";
import DndButton from "./DndButton";
import LaterView from "./LaterView";
import "./Sidebar.css";

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;

const FEED_DEFAULT_WIDTH = 420;
const FEED_MIN_WIDTH = 340;
const FEED_MAX_WIDTH = 640;

interface Category {
  id: string;
  name: string;
  channels: Channel[];
  custom: boolean;
}

function DmRow(props: { dm: DirectMessage }) {
  const user = createMemo(() => userById(props.dm.userId));
  const isActive = createMemo(() => {
    const v = activeView();
    return nav() === "home" && v?.kind === "dm" && v.id === props.dm.id;
  });

  return (
    <Show when={user()}>
      {(u) => (
        <div class="sidebar-row-wrap">
          <button
            type="button"
            class="sidebar-row"
            classList={{ active: isActive(), unread: !!unreadChannelIds[props.dm.id] }}
            onClick={() => setActiveView({ kind: "dm", id: props.dm.id })}
          >
            <Avatar user={u()} size="small" showPresence />
            <span class="sidebar-row-name">{u().name}</span>
          </button>
          <button
            type="button"
            class="sidebar-row-close"
            title="Close conversation"
            onClick={(e) => {
              e.stopPropagation();
              closeDmConversation(props.dm.id);
            }}
          >
            <Icon name="close" size={12} />
          </button>
          <InlineFeedback feedback={actionFeedback.get(props.dm.id)} class="sidebar-row-feedback" />
        </div>
      )}
    </Show>
  );
}

// Placeholder rows shown in place of the real channel list until bootstrap
// resolves — varied widths so it reads as "text loading", not a repeated block.
const SKELETON_ROW_WIDTHS = [120, 88, 150, 100, 70, 130, 95];

function SidebarSkeleton() {
  return (
    <div class="sidebar-section" aria-hidden="true">
      <div class="sidebar-section-header">
        <Skeleton width={64} height={11} />
      </div>
      <For each={SKELETON_ROW_WIDTHS}>
        {(w) => (
          <div class="sidebar-row">
            <Skeleton width={16} height={12} radius={3} />
            <Skeleton width={w} height={12} />
          </div>
        )}
      </For>
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());
  const [dmsOpen, setDmsOpen] = createSignal(true);
  const [appsOpen, setAppsOpen] = createSignal(true);
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [feedWidth, setFeedWidth] = createSignal(FEED_DEFAULT_WIDTH);
  const feedMode = createMemo(() => nav() === "later" || nav() === "activity");
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [unreadsOnly, setUnreadsOnly] = createSignal(false);
  const [sectionMenuOpen, setSectionMenuOpen] = createSignal<string | null>(null);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  const toggleCategory = (id: string) => {
    const next = new Set(collapsed());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };

  const categories = createMemo<Category[]>(() => {
    const allChannels = channels().filter((c) => !isChannelLeft(c.id));
    const matches = (c: Channel) => !unreadsOnly() || c.unread || !!unreadChannelIds[c.id];
    const byId = new Map(allChannels.map((c) => [c.id, c]));
    const used = new Set<string>();
    const result: Category[] = [];

    // Starred channels get pulled into their own group up top (like the real
    // client) and out of Channels/whatever section they'd otherwise land in —
    // sourced from the app's own starredChannelIds, not channel_sections'
    // built-in "stars" pseudo-section, which this workspace never populates.
    const starredIds = allChannels.filter((c) => isChannelStarred(c.id)).map((c) => c.id);
    if (starredIds.length > 0) {
      for (const id of starredIds) used.add(id);
      result.push({
        id: "__starred",
        name: "Starred",
        channels: starredIds
          .map((id) => byId.get(id))
          .filter((c): c is Channel => !!c && matches(c)),
        custom: false,
      });
    }

    const secs = sections();
    if (secs && secs.length > 0) {
      for (const s of secs) {
        const ids = s.channelIds.filter((id) => !used.has(id));
        for (const id of ids) used.add(id);
        result.push({
          id: s.id,
          name: s.name,
          channels: ids.map((id) => byId.get(id)).filter((c): c is Channel => !!c && matches(c)),
          custom: true,
        });
      }
      const rest = allChannels.filter((c) => !used.has(c.id) && matches(c));
      if (rest.length)
        result.push({ id: "__rest", name: "Channels", channels: rest, custom: false });
      return result;
    }

    const rest = allChannels.filter((c) => !used.has(c.id) && matches(c));
    result.push({ id: "channels", name: "Channels", channels: rest, custom: false });
    return result;
  });

  const startRename = (cat: Category) => {
    setSectionMenuOpen(null);
    setRenamingId(cat.id);
    setRenameValue(cat.name);
  };

  const commitRename = () => {
    const id = renamingId();
    const name = renameValue().trim();
    setRenamingId(null);
    if (id && name) renameChannelSection(id, name);
  };

  const filteredDms = createMemo(() =>
    directMessages().filter((dm) => !unreadsOnly() || dm.unread || !!unreadChannelIds[dm.id]),
  );

  const peopleDms = createMemo(() => filteredDms().filter((dm) => !userById(dm.userId)?.isBot));
  const appDms = createMemo(() => filteredDms().filter((dm) => userById(dm.userId)?.isBot));

  return (
    <div
      class="sidebar"
      classList={{ feed: feedMode() }}
      style={{ width: `${feedMode() ? feedWidth() : width()}px` }}
    >
      <ResizeHandle
        width={feedMode() ? feedWidth : width}
        setWidth={feedMode() ? setFeedWidth : setWidth}
        min={feedMode() ? FEED_MIN_WIDTH : MIN_WIDTH}
        max={feedMode() ? FEED_MAX_WIDTH : MAX_WIDTH}
        direction={1}
        side="right"
      />

      <div class="sidebar-top">
        <Show
          when={currentUser()}
          fallback={
            <div class="sidebar-me sidebar-me-skeleton">
              <Skeleton width={32} height={32} radius={8} />
              <Skeleton width={90} height={14} />
            </div>
          }
        >
          {(user) => (
            <button
              type="button"
              class="sidebar-me"
              title={`${user().name} — view your profile`}
              onClick={() => openUserProfile(user().id)}
            >
              <Avatar user={user()} size="medium" showPresence />
              <span class="sidebar-me-name">{user().name}</span>
            </button>
          )}
        </Show>
        <DndButton />
        <button
          type="button"
          class="sidebar-global-search-btn"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="settings" size={16} />
        </button>
        <button
          type="button"
          class="sidebar-global-search-btn"
          title="Search (Ctrl+K)"
          onClick={() => setSearchOpen(true)}
        >
          <Icon name="search" size={16} />
        </button>
      </div>

      <Show when={searchOpen()}>
        <GlobalSearch onClose={() => setSearchOpen(false)} />
      </Show>

      <Show when={settingsOpen()}>
        <Settings onClose={() => setSettingsOpen(false)} />
      </Show>

      <div class="sidebar-nav">
        <button
          type="button"
          class="sidebar-nav-btn"
          classList={{
            active: nav() === "home",
          }}
          onClick={() => {
            if (nav() === "home") setUnreadsOnly(!unreadsOnly());
            else setNavView("home");
          }}
        >
          <Icon name={"home"} size={16} />
          <Show when={unreadsOnly()} fallback="Home">
            Unread
          </Show>
        </button>
        <button
          type="button"
          class="sidebar-nav-btn"
          classList={{
            active: nav() === "activity",
            "has-glow": hasUnreadGlow(),
          }}
          onClick={() => setNavView("activity")}
        >
          <Icon name={"notifications"} size={16} />
          Activity
          <Show when={hasUnreadPing()}>
            <span class="sidebar-ping-dot" />
          </Show>
        </button>
        <button
          type="button"
          class="sidebar-nav-btn"
          classList={{
            active: nav() === "later",
          }}
          onClick={() => setNavView("later")}
        >
          <Icon name={"bookmark"} size={16} />
          Later
        </button>
      </div>

      <Show
        when={!feedMode()}
        fallback={
          <Switch>
            <Match when={nav() === "activity"}>
              <ActivityView />
            </Match>
            <Match when={nav() === "later"}>
              <LaterView />
            </Match>
          </Switch>
        }
      >
        <div class="sidebar-scroll">
          <Show when={!bootstrap.loading} fallback={<SidebarSkeleton />}>
            <For each={categories()}>
              {(cat) => (
                <div class="sidebar-section">
                  <div class="sidebar-section-header">
                    <Show
                      when={renamingId() !== cat.id}
                      fallback={
                        <input
                          class="sidebar-section-rename-input"
                          value={renameValue()}
                          onInput={(e) => setRenameValue(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={commitRename}
                          autofocus
                        />
                      }
                    >
                      <button
                        type="button"
                        class="sidebar-section-header-btn"
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <span
                          class="sidebar-caret"
                          classList={{ collapsed: collapsed().has(cat.id) }}
                        >
                          <Icon name="caret-down-filled" size={10} />
                        </span>
                        {cat.name}
                      </button>
                    </Show>
                    <InlineFeedback
                      feedback={actionFeedback.get(cat.id)}
                      class="sidebar-section-feedback"
                    />
                    <Show when={cat.custom && renamingId() !== cat.id}>
                      <Menu
                        class="sidebar-section-menu-wrap"
                        panelClass="menu-panel sidebar-section-menu"
                        open={sectionMenuOpen() === cat.id}
                        onClose={() => setSectionMenuOpen(null)}
                        trigger={
                          <button
                            type="button"
                            class="sidebar-section-menu-btn"
                            title="Section options"
                            onClick={() =>
                              setSectionMenuOpen(sectionMenuOpen() === cat.id ? null : cat.id)
                            }
                          >
                            <Icon name="ellipsis-vertical-filled" size={14} />
                          </button>
                        }
                      >
                        <button type="button" class="menu-item" onClick={() => startRename(cat)}>
                          Rename
                        </button>
                        <button
                          type="button"
                          class="menu-item danger"
                          onClick={() => {
                            setSectionMenuOpen(null);
                            if (
                              confirm(
                                `Delete section "${cat.name}"? Its channels won't be removed from the workspace.`,
                              )
                            ) {
                              deleteChannelSection(cat.id);
                            }
                          }}
                        >
                          Delete section
                        </button>
                      </Menu>
                    </Show>
                  </div>
                  <div style={{ display: collapsed().has(cat.id) ? "none" : "block" }}>
                    <For each={cat.channels}>
                      {(ch) => <ChannelRow channel={ch} unread={!!unreadChannelIds[ch.id]} />}
                    </For>
                  </div>
                </div>
              )}
            </For>

            <div class="sidebar-section">
              <div class="sidebar-section-header">
                <button
                  type="button"
                  class="sidebar-section-header-btn"
                  onClick={() => setDmsOpen(!dmsOpen())}
                >
                  <span class="sidebar-caret" classList={{ collapsed: !dmsOpen() }}>
                    <Icon name="caret-down-filled" size={10} />
                  </span>
                  Direct messages
                </button>
              </div>
              <div style={{ display: dmsOpen() ? "block" : "none" }}>
                <For each={peopleDms()}>{(dm) => <DmRow dm={dm} />}</For>
              </div>
            </div>

            <Show when={appDms().length > 0}>
              <div class="sidebar-section">
                <div class="sidebar-section-header">
                  <button
                    type="button"
                    class="sidebar-section-header-btn"
                    onClick={() => setAppsOpen(!appsOpen())}
                  >
                    <span class="sidebar-caret" classList={{ collapsed: !appsOpen() }}>
                      <Icon name="caret-down-filled" size={10} />
                    </span>
                    Apps
                  </button>
                </div>
                <div style={{ display: appsOpen() ? "block" : "none" }}>
                  <For each={appDms()}>{(dm) => <DmRow dm={dm} />}</For>
                </div>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}
