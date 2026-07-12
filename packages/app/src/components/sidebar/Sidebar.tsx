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
  reorderChannelSection,
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
  // Has a rename/delete menu — true only for real user-created sections.
  custom: boolean;
  // Has a real server-side channel_section_id to drag-reorder against —
  // true for custom sections and for the built-in Starred/Channels groups
  // (which Slack tracks as fixed pseudo-sections), false for the
  // synthesized fallback used when no section data loaded at all.
  reorderable: boolean;
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
  const [draggingSectionId, setDraggingSectionId] = createSignal<string | null>(null);
  const [dropTarget, setDropTarget] = createSignal<{ id: string; before: boolean } | null>(null);

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

    // Starred channels get pulled into their own group (like the real client)
    // and out of whatever section they'd otherwise land in — sourced from the
    // app's own starredChannelIds rather than trusting channel_ids on
    // channel_sections' built-in "stars" pseudo-section, which this workspace
    // never populates. The pseudo-section's id is still used below (when
    // present) so the group has something real to drag-reorder against.
    const starredIds = allChannels.filter((c) => isChannelStarred(c.id)).map((c) => c.id);

    const secs = sections() ?? [];
    const standardSecs = secs.filter((s) => s.type === "standard");

    const usedForRest = new Set<string>(starredIds);
    for (const s of standardSecs) for (const id of s.channelIds) usedForRest.add(id);
    const restChannels = allChannels.filter((c) => !usedForRest.has(c.id));

    // Standard sections claim their channels in order, so a channel double-listed
    // across sections (shouldn't happen, but Slack's payload isn't a contract)
    // only ever shows up in the first one.
    const claimed = new Set<string>(starredIds);
    const standardChannelsById = new Map<string, Channel[]>();
    for (const s of standardSecs) {
      const ids = s.channelIds.filter((id) => !claimed.has(id));
      for (const id of ids) claimed.add(id);
      standardChannelsById.set(
        s.id,
        ids.map((id) => byId.get(id)).filter((c): c is Channel => !!c),
      );
    }

    const result: Category[] = [];

    const pushStarred = (id: string, reorderable: boolean) => {
      if (starredIds.length === 0) return;
      const list = starredIds
        .map((cid) => byId.get(cid))
        .filter((c): c is Channel => !!c && matches(c));
      if (list.length > 0 || !unreadsOnly())
        result.push({ id, name: "Starred", channels: list, custom: false, reorderable });
    };
    const pushChannels = (id: string, reorderable: boolean) => {
      if (restChannels.length === 0) return;
      const list = restChannels.filter(matches);
      if (list.length > 0 || !unreadsOnly())
        result.push({ id, name: "Channels", channels: list, custom: false, reorderable });
    };

    if (secs.length === 0) {
      // No section data loaded at all — fall back to a plain Starred-then-rest
      // split with no drag support, since there's no server id to reorder against.
      pushStarred("__starred", false);
      pushChannels("channels", false);
      return result;
    }

    for (const s of secs) {
      if (s.type === "stars") {
        pushStarred(s.id, true);
      } else if (s.type === "channels") {
        pushChannels(s.id, true);
      } else if (s.type === "standard") {
        const list = (standardChannelsById.get(s.id) ?? []).filter(matches);
        if (list.length > 0 || !unreadsOnly())
          result.push({ id: s.id, name: s.name, channels: list, custom: true, reorderable: true });
      }
      // Other built-in pseudo-sections (direct_messages, recent_apps, ...)
      // are rendered by their own dedicated blocks below, not through here.
    }
    // Defensive fallback in case Slack ever omits one of these pseudo-sections.
    if (!secs.some((s) => s.type === "stars")) pushStarred("__starred", false);
    if (!secs.some((s) => s.type === "channels")) pushChannels("channels", false);
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

  const handleSectionDragStart = (e: DragEvent, id: string) => {
    setDraggingSectionId(id);
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };

  const handleSectionDragOver = (e: DragEvent, id: string) => {
    if (!draggingSectionId() || draggingSectionId() === id) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropTarget({ id, before: e.clientY < rect.top + rect.height / 2 });
  };

  const handleSectionDragLeave = (id: string) => {
    setDropTarget((t) => (t?.id === id ? null : t));
  };

  const handleSectionDrop = (e: DragEvent) => {
    e.preventDefault();
    const draggedId = draggingSectionId();
    const target = dropTarget();
    setDraggingSectionId(null);
    setDropTarget(null);
    if (!draggedId || !target || draggedId === target.id) return;
    const otherReorderableIds = categories()
      .filter((c) => c.reorderable && c.id !== draggedId)
      .map((c) => c.id);
    const targetIndex = otherReorderableIds.indexOf(target.id);
    const nextSectionId = target.before
      ? target.id
      : (otherReorderableIds[targetIndex + 1] ?? null);
    reorderChannelSection(draggedId, nextSectionId);
  };

  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDropTarget(null);
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
                <div
                  class="sidebar-section"
                  classList={{
                    "sidebar-section-dragging": cat.reorderable && draggingSectionId() === cat.id,
                    "sidebar-section-drop-before":
                      cat.reorderable &&
                      dropTarget()?.id === cat.id &&
                      dropTarget()?.before === true,
                    "sidebar-section-drop-after":
                      cat.reorderable &&
                      dropTarget()?.id === cat.id &&
                      dropTarget()?.before === false,
                  }}
                >
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-to-reorder is a mouse-only convenience; the section's own menu (Rename/Delete) stays fully keyboard-reachable */}
                  <div
                    class="sidebar-section-header"
                    classList={{ "sidebar-section-header-draggable": cat.reorderable }}
                    draggable={cat.reorderable && renamingId() !== cat.id}
                    onDragStart={(e) => cat.reorderable && handleSectionDragStart(e, cat.id)}
                    onDragOver={(e) => cat.reorderable && handleSectionDragOver(e, cat.id)}
                    onDragLeave={() => cat.reorderable && handleSectionDragLeave(cat.id)}
                    onDrop={(e) => cat.reorderable && handleSectionDrop(e)}
                    onDragEnd={handleSectionDragEnd}
                  >
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
                      {(ch) => (
                        <ChannelRow channel={ch} unread={ch.unread || !!unreadChannelIds[ch.id]} />
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>

            <Show when={peopleDms().length > 0 || !unreadsOnly()}>
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
            </Show>

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
