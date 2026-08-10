import { Avatar, IconButton, Skeleton } from "@slock/ui";
import { lazy, Show } from "solid-js";
import GlobalSearch from "../search/GlobalSearch";
import DndButton from "./dnd/DndButton";
import type { SidebarContext } from "./sidebarCategories";

// Settings pulls in four tab components' worth of forms and switches for
// something most sessions never open — split it out of the main chunk
// instead of paying for it on every load.
const Settings = lazy(() => import("../settings/Settings"));

type SidebarToolbarProps = Pick<
  SidebarContext,
  | "currentUser"
  | "openUserProfile"
  | "searchOpen"
  | "setSearchOpen"
  | "setSettingsOpen"
  | "settingsOpen"
>;

export default function SidebarToolbar(props: SidebarToolbarProps) {
  return (
    <>
      <div class="sidebar-top flex-align-center">
        <Show
          fallback={
            <div class="sidebar-me sidebar-me-skeleton flex-align-center">
              <Skeleton height={32} radius={8} width={32} />
              <Skeleton height={14} width={90} />
            </div>
          }
          when={props.currentUser()}
        >
          {(user) => (
            <button
              class="sidebar-me btn-reset flex-align-center"
              onClick={() => props.openUserProfile(user().id)}
              type="button"
            >
              <Avatar showPresence size="medium" user={user()} />
              <span class="sidebar-me-name truncate">{user().name}</span>
            </button>
          )}
        </Show>
        <DndButton />
        <IconButton
          class="sidebar-global-search-btn"
          icon="settings"
          label="Settings"
          onClick={() => props.setSettingsOpen(true)}
        />
        <IconButton
          class="sidebar-global-search-btn"
          icon="search"
          label="Search (Ctrl+K)"
          onClick={() => props.setSearchOpen(true)}
        />
      </div>
      <Show when={props.searchOpen()}>
        <GlobalSearch onClose={() => props.setSearchOpen(false)} />
      </Show>
      <Show when={props.settingsOpen()}>
        <Settings onClose={() => props.setSettingsOpen(false)} />
      </Show>
    </>
  );
}
