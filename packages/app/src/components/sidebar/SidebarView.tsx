import { EmojiText } from "@slock/blockkit";
import { Button, Icon, InlineFeedback, ResizeHandle } from "@slock/ui";
import { For, Match, Show, Switch } from "solid-js";
import { store } from "../../lib/store";
import MessageSearchView from "../search/MessageSearchView";
import ActivityView from "./activity/ActivityView";
import LaterView from "./LaterView";
import ChannelRow from "./rows/ChannelRow";
import SidebarDmSections, { SidebarUnreadDmSection } from "./rows/SidebarDmSections";
import { SidebarSectionCaretRow, SidebarSkeleton } from "./rows/sidebar-rows";
import SidebarSectionMenu from "./SidebarSectionMenu";
import SidebarToolbar from "./SidebarToolbar";
import type { SidebarContext } from "./sidebarCategories";

export default function SidebarView(props: { context: SidebarContext }) {
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
    recentReactionEmoji,
    bootstrap,
    categories,
    collapsed,
    draggingSectionId,
    dropTarget,
    renamingId,
    setRenamingId,
    renameValue,
    setRenameValue,
    commitRename,
    toggleCategory,
    toggleSectionFilter,
    retrySections,
    sectionsError,
    sectionsLoading,
    sectionStructurePending,
    handleSectionDragStart,
    handleSectionDragOver,
    handleSectionDragLeave,
    handleSectionDrop,
    handleSectionDragEnd,
    peopleDms,
    preferencesError,
    preferencesLoading,
    retryPreferences,
    dmsOpen,
    setDmsOpen,
    appDms,
    appsOpen,
    setAppsOpen,
    unreadDms,
    unreadDmsOpen,
    setUnreadDmsOpen,
    unreadChannelIds,
    actionFeedback,
  } = props.context;
  return (
    <div
      class="sidebar flex-col"
      classList={{ feed: feedMode() }}
      data-pane="sidebar"
      style={{ width: `${feedMode() ? feedWidth() : width()}px` }}
    >
      <ResizeHandle
        direction={1}
        label="Resize sidebar"
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
          <Show fallback={<Icon name="notifications" size={16} />} when={recentReactionEmoji()}>
            {(name) => (
              <span class="sidebar-nav-reaction-emoji">
                <EmojiText text={`:${name()}:`} />
              </span>
            )}
          </Show>
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
            <Match when={nav() === "search"}>
              <MessageSearchView />
            </Match>
          </Switch>
        }
        when={!feedMode()}
      >
        <div class="sidebar-scroll">
          <Show fallback={<SidebarSkeleton />} when={!bootstrap.loading}>
            <Show when={preferencesError()}>
              <div class="sidebar-resource-error">
                <span>Couldn't load preferences.</span>
                <Button
                  disabled={preferencesLoading()}
                  onClick={() => void retryPreferences()}
                  size="sm"
                  variant="ghost"
                >
                  {preferencesLoading() ? "Retrying…" : "Try again"}
                </Button>
              </div>
            </Show>
            <Show when={sectionsError()}>
              <div class="sidebar-resource-error">
                <span>Couldn't load custom sections.</span>
                <Button
                  disabled={sectionsLoading()}
                  onClick={() => void retrySections()}
                  size="sm"
                  variant="ghost"
                >
                  {sectionsLoading() ? "Retrying…" : "Try again"}
                </Button>
              </div>
            </Show>
            <SidebarUnreadDmSection {...{ setUnreadDmsOpen, unreadDms, unreadDmsOpen }} />
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
                  <div
                    class="sidebar-section-header flex-align-center"
                    classList={{
                      "sidebar-section-header-draggable":
                        cat.reorderable && !sectionStructurePending(),
                    }}
                    draggable={
                      cat.reorderable && renamingId() !== cat.id && !sectionStructurePending()
                    }
                    onDragEnd={handleSectionDragEnd}
                    onDragLeave={() => cat.reorderable && handleSectionDragLeave(cat.id)}
                    onDragOver={(e) => cat.reorderable && handleSectionDragOver(e, cat.id)}
                    onDragStart={(e) => cat.reorderable && handleSectionDragStart(e, cat.id)}
                    onDrop={(e) => cat.reorderable && handleSectionDrop(e)}
                  >
                    <Show
                      fallback={
                        <input
                          aria-busy={sectionStructurePending()}
                          autofocus
                          class="sidebar-section-rename-input"
                          onBlur={() => void commitRename()}
                          onInput={(e) => setRenameValue(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitRename();
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setRenamingId(null);
                            }
                          }}
                          readOnly={sectionStructurePending()}
                          value={renameValue()}
                        />
                      }
                      when={renamingId() !== cat.id}
                    >
                      <SidebarSectionCaretRow
                        caretIcon={
                          collapsed().has(cat.id)
                            ? "caret-right-filled"
                            : cat.sidebar === "all"
                              ? "caret-down-filled"
                              : "section"
                        }
                        label={cat.name}
                        labelAriaLabel={`Toggle read channels in ${cat.name}`}
                        onLabelClick={() => toggleSectionFilter(cat.id)}
                        onToggleOpen={() => toggleCategory(cat.id)}
                        open={!collapsed().has(cat.id)}
                      />
                    </Show>
                    <InlineFeedback
                      class="sidebar-section-feedback"
                      feedback={actionFeedback.get(cat.id)}
                    />
                    <Show when={cat.filterable && renamingId() !== cat.id}>
                      <SidebarSectionMenu cat={cat} context={props.context} />
                    </Show>
                  </div>
                  <div>
                    <For each={cat.channels}>
                      {(ch) => (
                        <Show
                          when={
                            !collapsed().has(cat.id) ||
                            ((ch.mentions ?? 0) > 0 && !store.preferences.isChannelMuted(ch.id))
                          }
                        >
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
