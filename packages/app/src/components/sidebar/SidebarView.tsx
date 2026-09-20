import { EmojiText } from "@slock/blockkit";
import { Button, Icon, InlineFeedback, ResizeHandle, tabStripKeyDown } from "@slock/ui";
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { store } from "../../lib/store";
import type { Nav } from "../../lib/store/slices/types";
import MessageSearchView from "../search/MessageSearchView";
import ActivityView from "./activity/ActivityView";
import LaterView from "./LaterView";
import ChannelRow from "./rows/ChannelRow";
import SidebarDmSections, { SidebarUnreadDmSection } from "./rows/SidebarDmSections";
import { SidebarSectionCaretRow, SidebarSkeleton } from "./rows/SidebarRows";
import SidebarSectionMenu from "./SidebarSectionMenu";
import SidebarToolbar from "./SidebarToolbar";
import SidebarUnreadEdgeIndicator from "./SidebarUnreadEdgeIndicator";
import { idsEqual, type SidebarContext } from "./sidebarCategories";

const SIDEBAR_NAV_TABS: Nav[] = ["home", "activity", "later"];

function SidebarCategorySection(props: { context: SidebarContext; id: string }) {
  const {
    categories,
    draggingSectionId,
    dropTarget,
    collapsed,
    renamingId,
    setRenamingId,
    renameValue,
    setRenameValue,
    commitRename,
    toggleCategory,
    toggleSectionFilter,
    sectionStructurePending,
    handleSectionDragStart,
    handleSectionDragEnd,
    actionFeedback,
  } = props.context;
  const cat = createMemo(() => categories().find((c) => c.id === props.id));
  const channelIds = createMemo(() => cat()?.channels.map((ch) => ch.id) ?? [], undefined, {
    equals: idsEqual,
  });
  return (
    <div
      class="sidebar-section"
      classList={{
        "sidebar-section-dragging": cat()?.reorderable && draggingSectionId() === props.id,
        "sidebar-section-drop-after":
          cat()?.reorderable &&
          dropTarget()?.id === props.id &&
          dropTarget()?.before === false &&
          draggingSectionId() !== props.id,
        "sidebar-section-drop-before":
          cat()?.reorderable &&
          dropTarget()?.id === props.id &&
          dropTarget()?.before === true &&
          draggingSectionId() !== props.id,
      }}
      data-reorderable={cat()?.reorderable ? "true" : undefined}
      data-section-id={props.id}
    >
      <div
        class="sidebar-section-header flex-align-center"
        classList={{
          "sidebar-section-header-draggable": cat()?.reorderable && !sectionStructurePending(),
        }}
        draggable={cat()?.reorderable && renamingId() !== props.id && !sectionStructurePending()}
        onDragEnd={handleSectionDragEnd}
        onDragStart={(e) => cat()?.reorderable && handleSectionDragStart(e, props.id)}
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
          when={renamingId() !== props.id}
        >
          <SidebarSectionCaretRow
            caretIcon={
              collapsed().has(props.id)
                ? "caret-right-filled"
                : cat()?.sidebar === "hid"
                  ? "section"
                  : "caret-down-filled"
            }
            label={cat()?.name ?? ""}
            labelAriaLabel={`Toggle read channels in ${cat()?.name ?? ""}`}
            onLabelClick={() => toggleSectionFilter(props.id)}
            onToggleOpen={() => toggleCategory(props.id)}
            open={!collapsed().has(props.id)}
          />
        </Show>
        <InlineFeedback class="sidebar-section-feedback" feedback={actionFeedback.get(props.id)} />
        <Show when={renamingId() !== props.id && cat()?.filterable ? cat() : undefined}>
          {(c) => <SidebarSectionMenu cat={c()} context={props.context} />}
        </Show>
      </div>
      <div>
        <For each={channelIds()}>
          {(chId) => (
            <SidebarCategoryChannelRow catId={props.id} channelId={chId} context={props.context} />
          )}
        </For>
      </div>
    </div>
  );
}

function SidebarCategoryChannelRow(props: {
  catId: string;
  channelId: string;
  context: SidebarContext;
}) {
  const { channelById, collapsed, isChannelUnread } = props.context;
  const channel = createMemo(() => channelById().get(props.channelId));
  const isActiveChannel = () =>
    store.viewState.nav() === "home" && store.panes.isOpenInAnyPane(props.channelId, "channel");
  return (
    <Show when={channel()}>
      {(ch) => (
        <Show
          when={
            !collapsed().has(props.catId) ||
            isActiveChannel() ||
            ((ch().mentions ?? 0) > 0 && !store.preferences.isChannelMuted(props.channelId))
          }
        >
          <ChannelRow channel={ch()} unread={isChannelUnread(props.channelId)} />
        </Show>
      )}
    </Show>
  );
}

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
    settingsTab,
    setSettingsTab,
    nav,
    setNavView,
    unreadsOnly,
    setUnreadsOnly,
    hasUnreadActivity,
    unreadPingCount,
    recentReactionEmoji,
    bootstrap,
    categories,
    retrySections,
    sectionsError,
    sectionsLoading,
    handleSectionDrop,
    handleSectionsDragOver,
    handleSectionsDragLeave,
    setSectionListRef,
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
  } = props.context;
  const [scrollEl, setScrollEl] = createSignal<HTMLDivElement>();
  const categoryIds = createMemo(() => categories().map((c) => c.id), undefined, {
    equals: idsEqual,
  });
  const navTabRefs: (HTMLButtonElement | undefined)[] = [];
  const activeNavTabIndex = () => Math.max(SIDEBAR_NAV_TABS.indexOf(nav()), 0);
  const navTabKeyDown = (event: KeyboardEvent, index: number) =>
    tabStripKeyDown(event, SIDEBAR_NAV_TABS, index, (next, nextIndex) => {
      setNavView(next);
      navTabRefs[nextIndex]?.focus();
    });
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
          setSettingsTab,
          settingsTab,
        }}
      />
      <div class="sidebar-nav flex-align-center" role="tablist">
        <button
          aria-selected={nav() === "home"}
          class="sidebar-nav-btn btn-reset flex-center"
          classList={{
            active: nav() === "home",
          }}
          onClick={() => {
            if (nav() === "home") setUnreadsOnly(!unreadsOnly());
            else setNavView("home");
          }}
          onKeyDown={(e) => navTabKeyDown(e, 0)}
          ref={(el) => {
            navTabRefs[0] = el;
          }}
          role="tab"
          tabIndex={activeNavTabIndex() === 0 ? 0 : -1}
          type="button"
        >
          <Icon name={unreadsOnly() ? "mark-as-unread" : "home"} size={16} />
        </button>
        <button
          aria-selected={nav() === "activity"}
          class="sidebar-nav-btn btn-reset flex-center"
          classList={{
            active: nav() === "activity",
          }}
          onClick={() => setNavView("activity")}
          onKeyDown={(e) => navTabKeyDown(e, 1)}
          ref={(el) => {
            navTabRefs[1] = el;
          }}
          role="tab"
          tabIndex={activeNavTabIndex() === 1 ? 0 : -1}
          type="button"
        >
          <span class="sidebar-nav-btn-icon">
            <Show fallback={<Icon name="notifications" size={16} />} when={recentReactionEmoji()}>
              {(name) => (
                <span class="sidebar-nav-reaction-emoji">
                  <EmojiText text={`:${name()}:`} />
                </span>
              )}
            </Show>
            <Show when={hasUnreadActivity()}>
              <span class="sidebar-ping-dot" classList={{ "has-count": unreadPingCount() > 0 }}>
                <Show when={unreadPingCount() > 0}>{unreadPingCount()}</Show>
              </span>
            </Show>
          </span>
        </button>
        <button
          aria-selected={nav() === "later"}
          class="sidebar-nav-btn btn-reset flex-center"
          classList={{
            active: nav() === "later",
          }}
          onClick={() => setNavView("later")}
          onKeyDown={(e) => navTabKeyDown(e, 2)}
          ref={(el) => {
            navTabRefs[2] = el;
          }}
          role="tab"
          tabIndex={activeNavTabIndex() === 2 ? 0 : -1}
          type="button"
        >
          <Icon name="bookmark" size={16} />
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
        <div class="sidebar-scroll-wrap">
          <div class="sidebar-scroll" ref={setScrollEl}>
            <Show
              fallback={<SidebarSkeleton />}
              when={!(bootstrap.isFetching || sectionsLoading() || preferencesLoading())}
            >
              <Show when={preferencesError()}>
                <div class="sidebar-resource-error">
                  <span>Couldn't load preferences.</span>
                  <Button
                    disabled={preferencesLoading()}
                    onClick={() => void retryPreferences()}
                    size="sm"
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
                  >
                    {sectionsLoading() ? "Retrying…" : "Try again"}
                  </Button>
                </div>
              </Show>
              <SidebarUnreadDmSection {...{ setUnreadDmsOpen, unreadDms, unreadDmsOpen }} />
              <div
                class="sidebar-section-list"
                onDragLeave={handleSectionsDragLeave}
                onDragOver={handleSectionsDragOver}
                onDrop={handleSectionDrop}
                ref={setSectionListRef}
              >
                <For each={categoryIds()}>
                  {(id) => <SidebarCategorySection context={props.context} id={id} />}
                </For>
              </div>
              <SidebarDmSections
                {...{ appDms, appsOpen, dmsOpen, peopleDms, setAppsOpen, setDmsOpen, unreadsOnly }}
              />
            </Show>
          </div>
          <SidebarUnreadEdgeIndicator containerRef={scrollEl} />
        </div>
      </Show>
    </div>
  );
}
