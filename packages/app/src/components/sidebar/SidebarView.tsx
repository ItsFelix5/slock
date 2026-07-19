import { Icon, InlineFeedback, Menu, ResizeHandle, SegmentedControl, Tooltip } from "@slock/ui";
import { For, Match, Show, Switch } from "solid-js";
import ActivityView from "./activity/ActivityView";
import LaterView from "./LaterView";
import ChannelRow from "./rows/ChannelRow";
import SidebarDmSections from "./rows/SidebarDmSections";
import { SidebarSkeleton } from "./rows/SidebarRows";
import SidebarToolbar from "./SidebarToolbar";
import type { SidebarContext } from "./sidebarCategories";

export default function SidebarView({ context }: { context: SidebarContext }) {
  const {
    feedMode,
    feedWidth,
    setFeedWidth,
    width,
    setWidth,
    feedMinWidth,
    feedMaxWidth,
    minWidth,
    maxWidth,
    currentUser,
    openUserProfile,
    searchOpen,
    setSearchOpen,
    settingsOpen,
    setSettingsOpen,
    nav,
    setNavView,
    unreadsOnly,
    setUnreadsOnly,
    hasUnreadActivity,
    unreadPingCount,
    bootstrap,
    categories,
    collapsed,
    expandedSectionIds,
    draggingSectionId,
    dropTarget,
    renamingId,
    setRenamingId,
    renameValue,
    setRenameValue,
    commitRename,
    toggleCategory,
    showAllInCategory,
    startRename,
    sectionMenuOpen,
    setSectionMenuOpen,
    setChannelSectionSidebar,
    deleteChannelSection,
    handleSectionDragStart,
    handleSectionDragOver,
    handleSectionDragLeave,
    handleSectionDrop,
    handleSectionDragEnd,
    peopleDms,
    dmsOpen,
    setDmsOpen,
    appDms,
    appsOpen,
    setAppsOpen,
    unreadChannelIds,
    actionFeedback,
  } = context;
  return (
    <div
      class="sidebar flex-col"
      classList={{ feed: feedMode() }}
      style={{ width: `${feedMode() ? feedWidth() : width()}px` }}
    >
      <ResizeHandle
        direction={1}
        max={feedMode() ? feedMaxWidth : maxWidth}
        min={feedMode() ? feedMinWidth : minWidth}
        setWidth={feedMode() ? setFeedWidth : setWidth}
        side="right"
        width={feedMode() ? feedWidth : width}
      />
      <SidebarToolbar
        {...{
          currentUser,
          openUserProfile,
          searchOpen,
          setSearchOpen,
          setSettingsOpen,
          settingsOpen,
        }}
      />
      <div class="sidebar-nav flex-align-center">
        <button
          class="sidebar-nav-btn btn-reset flex-col"
          classList={{
            active: nav() === "home",
          }}
          onClick={() => {
            if (nav() === "home") setUnreadsOnly(!unreadsOnly());
            else setNavView("home");
          }}
          type="button"
        >
          <Icon name="home" size={16} />
          <Show fallback="Channels" when={unreadsOnly()}>
            Unread
          </Show>
        </button>
        <button
          class="sidebar-nav-btn btn-reset flex-col"
          classList={{
            active: nav() === "activity",
          }}
          onClick={() => setNavView("activity")}
          type="button"
        >
          <Icon name="notifications" size={16} />
          Activity
          <Show when={hasUnreadActivity()}>
            <span class="sidebar-ping-dot" classList={{ "has-count": unreadPingCount() > 0 }}>
              <Show when={unreadPingCount() > 0}>{unreadPingCount()}</Show>
            </span>
          </Show>
        </button>
        <button
          class="sidebar-nav-btn btn-reset flex-col"
          classList={{
            active: nav() === "later",
          }}
          onClick={() => setNavView("later")}
          type="button"
        >
          <Icon name="bookmark" size={16} />
          Later
        </button>
      </div>
      <Show
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
        when={!feedMode()}
      >
        <div class="sidebar-scroll">
          <Show fallback={<SidebarSkeleton />} when={!bootstrap.loading}>
            <For each={categories()}>
              {(cat) => (
                <div
                  class="sidebar-section"
                  classList={{
                    "sidebar-section-dragging": cat.reorderable && draggingSectionId() === cat.id,
                    "sidebar-section-drop-after":
                      cat.reorderable &&
                      dropTarget()?.id === cat.id &&
                      dropTarget()?.before === false,
                    "sidebar-section-drop-before":
                      cat.reorderable &&
                      dropTarget()?.id === cat.id &&
                      dropTarget()?.before === true,
                  }}
                >
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-to-reorder is a mouse-only convenience; the section's own menu (Rename/Delete) stays fully keyboard-reachable */}
                  <div
                    class="sidebar-section-header flex-align-center"
                    classList={{ "sidebar-section-header-draggable": cat.reorderable }}
                    draggable={cat.reorderable && renamingId() !== cat.id}
                    onDragEnd={handleSectionDragEnd}
                    onDragLeave={() => cat.reorderable && handleSectionDragLeave(cat.id)}
                    onDragOver={(e) => cat.reorderable && handleSectionDragOver(e, cat.id)}
                    onDragStart={(e) => cat.reorderable && handleSectionDragStart(e, cat.id)}
                    onDrop={(e) => cat.reorderable && handleSectionDrop(e)}
                  >
                    <Show
                      fallback={
                        <input
                          autofocus
                          class="sidebar-section-rename-input"
                          onBlur={commitRename}
                          onInput={(e) => setRenameValue(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          value={renameValue()}
                        />
                      }
                      when={renamingId() !== cat.id}
                    >
                      <div class="sidebar-section-header-btn flex-align-center text-muted text-sm">
                        <button
                          aria-label={`Collapse ${cat.name}`}
                          class="sidebar-caret btn-reset"
                          onClick={() => toggleCategory(cat.id)}
                          type="button"
                        >
                          <Icon
                            name={
                              collapsed().has(cat.id)
                                ? "caret-right-filled"
                                : cat.sidebar === "all" || !expandedSectionIds().has(cat.id)
                                  ? "section"
                                  : "caret-down-filled"
                            }
                            size={12}
                          />
                        </button>
                        <button
                          class="btn-reset text-muted text-sm"
                          onClick={() => showAllInCategory(cat.id)}
                          type="button"
                        >
                          {cat.name}
                        </button>
                      </div>
                    </Show>
                    <InlineFeedback
                      class="sidebar-section-feedback"
                      feedback={actionFeedback.get(cat.id)}
                    />
                    <Show when={cat.custom && renamingId() !== cat.id}>
                      <Menu
                        align="end"
                        class="sidebar-section-menu-wrap"
                        onClose={() => setSectionMenuOpen(null)}
                        open={sectionMenuOpen() === cat.id}
                        panelClass="menu-panel sidebar-section-menu"
                        trigger={
                          <Tooltip content="Section options">
                            <button
                              aria-label="Section options"
                              class="sidebar-section-menu-btn btn-reset icon-btn icon-action"
                              onClick={() =>
                                setSectionMenuOpen(sectionMenuOpen() === cat.id ? null : cat.id)
                              }
                              type="button"
                            >
                              <Icon name="ellipsis-vertical-filled" size={14} />
                            </button>
                          </Tooltip>
                        }
                      >
                        <button class="menu-item" onClick={() => startRename(cat)} type="button">
                          Rename
                        </button>
                        <div class="sidebar-section-filter">
                          <SegmentedControl>
                            <button
                              class="segmented-control-btn"
                              classList={{ active: cat.sidebar === "hid" }}
                              onClick={() => {
                                setSectionMenuOpen(null);
                                setChannelSectionSidebar(cat.id, "hid");
                              }}
                              type="button"
                            >
                              Unread
                            </button>
                            <button
                              class="segmented-control-btn"
                              classList={{ active: cat.sidebar === "active" }}
                              onClick={() => {
                                setSectionMenuOpen(null);
                                setChannelSectionSidebar(cat.id, "active");
                              }}
                              type="button"
                            >
                              Active
                            </button>
                            <button
                              class="segmented-control-btn"
                              classList={{ active: cat.sidebar === "all" }}
                              onClick={() => {
                                setSectionMenuOpen(null);
                                setChannelSectionSidebar(cat.id, "all");
                              }}
                              type="button"
                            >
                              All
                            </button>
                          </SegmentedControl>
                        </div>
                        <button
                          class="menu-item danger"
                          onClick={() => {
                            setSectionMenuOpen(null);
                            if (
                              // biome-ignore lint/suspicious/noAlert: Deleting a section requires explicit confirmation.
                              confirm(
                                `Delete section "${cat.name}"? Its channels won't be removed from the workspace.`,
                              )
                            ) {
                              deleteChannelSection(cat.id);
                            }
                          }}
                          type="button"
                        >
                          Delete section
                        </button>
                      </Menu>
                    </Show>
                  </div>
                  <div>
                    <For each={cat.channels}>
                      {(ch) => (
                        <Show when={!collapsed().has(cat.id) || (ch.mentions ?? 0) > 0}>
                          <ChannelRow channel={ch} unread={!!unreadChannelIds[ch.id]} />
                        </Show>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
            <SidebarDmSections
              {...{ appDms, appsOpen, dmsOpen, peopleDms, setAppsOpen, setDmsOpen, unreadsOnly }}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
