import { service, usePoint } from "@slock/core/solid";
import { ResizeHandle, useTabStripShortcuts } from "@slock/ui";
import { createEffect, createMemo, createSignal, For } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { SidebarNavItem } from "../api";
import "./Sidebar.css";
import SidebarToolbar from "./SidebarToolbar";

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;
const FEED_DEFAULT_WIDTH = 420;
const FEED_MIN_WIDTH = 340;
const FEED_MAX_WIDTH = 640;

export default function Sidebar(props: { onWidth: (width: number) => void }) {
  const sidebar = service("sidebar");
  const items = usePoint("sidebar.nav");
  const tabs = createMemo(() => items().filter((item) => !item.hidden));
  const active = createMemo(() => items().find((item) => item.id === sidebar.nav()));
  const feedMode = () => !!active()?.feed;
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [feedWidth, setFeedWidth] = createSignal(FEED_DEFAULT_WIDTH);
  createEffect(() => props.onWidth(feedMode() ? feedWidth() : width()));

  const select = (item: SidebarNavItem) => {
    if (item.select) item.select(sidebar.nav() === item.id);
    else sidebar.setNavView(item.id);
  };
  const navTabRefs: (HTMLButtonElement | undefined)[] = [];
  let navTabListRef: HTMLDivElement | undefined;
  useTabStripShortcuts<SidebarNavItem>({
    activate: (next, nextIndex) => {
      select(next);
      navTabRefs[nextIndex]?.focus();
    },
    items: tabs,
    root: () => navTabListRef,
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
        max={feedMode() ? FEED_MAX_WIDTH : MAX_WIDTH}
        min={feedMode() ? FEED_MIN_WIDTH : MIN_WIDTH}
        setWidth={feedMode() ? setFeedWidth : setWidth}
        side="right"
        width={feedMode() ? feedWidth : width}
      />
      <SidebarToolbar />
      <div class="sidebar-nav flex-align-center" ref={navTabListRef} role="tablist">
        <For each={tabs()}>
          {(item, index) => (
            <button
              aria-label={item.label}
              aria-selected={sidebar.nav() === item.id}
              class="sidebar-nav-btn btn-reset flex-center hover-hl"
              classList={{ active: sidebar.nav() === item.id }}
              onClick={() => select(item)}
              ref={(el) => {
                navTabRefs[index()] = el;
              }}
              role="tab"
              tabIndex={sidebar.nav() === item.id || (!active() && index() === 0) ? 0 : -1}
              type="button"
            >
              <Dynamic active={sidebar.nav() === item.id} component={item.button} />
            </button>
          )}
        </For>
      </div>
      <Dynamic component={active()?.view} />
    </div>
  );
}
