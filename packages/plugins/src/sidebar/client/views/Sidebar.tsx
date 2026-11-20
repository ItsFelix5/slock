import { service, usePoint } from "@slock/core/solid";
import { ariaBoolean, ResizeHandle, useTabStripShortcuts } from "@slock/ui";
import { dynamic } from "@solidjs/web";
import { createComponent, createEffect, createMemo, createSignal, For } from "solid-js";
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
  const ActiveView = dynamic(() => active()?.view);
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [feedWidth, setFeedWidth] = createSignal(FEED_DEFAULT_WIDTH);
  createEffect(
    () => (feedMode() ? feedWidth() : width()),
    (current) => props.onWidth(current),
  );

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
      class={["sidebar flex-col", { feed: feedMode() }]}
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
              aria-selected={ariaBoolean(sidebar.nav() === item.id)}
              class={[
                "sidebar-nav-btn btn-reset flex-center hover-hl",
                { active: sidebar.nav() === item.id },
              ]}
              onClick={() => select(item)}
              ref={(el) => {
                navTabRefs[index()] = el;
              }}
              role="tab"
              tabindex={sidebar.nav() === item.id || (!active() && index() === 0) ? 0 : -1}
              type="button"
            >
              {createComponent(item.button, {
                get active() {
                  return sidebar.nav() === item.id;
                },
              })}
            </button>
          )}
        </For>
      </div>
      <ActiveView />
    </div>
  );
}
