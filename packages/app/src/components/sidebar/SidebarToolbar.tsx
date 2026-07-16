import { Avatar, Icon, Skeleton, Tooltip } from "@slock/ui";
import { Show } from "solid-js";
import GlobalSearch from "../search/GlobalSearch";
import Settings from "../settings/Settings";
import DndButton from "./dnd/DndButton";

export default function SidebarToolbar(props: any) {
  return (
    <>
      <div class="sidebar-top flex-align-center">
        <Show
          fallback={
            <div class="sidebar-me sidebar-me-skeleton">
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
        <Tooltip content="Settings">
          <button
            aria-label="Settings"
            class="sidebar-global-search-btn btn-reset icon-btn icon-action"
            onClick={() => props.setSettingsOpen(true)}
            type="button"
          >
            <Icon name="settings" size={16} />
          </button>
        </Tooltip>
        <Tooltip content="Search (Ctrl+K)">
          <button
            aria-label="Search (Ctrl+K)"
            class="sidebar-global-search-btn btn-reset icon-btn icon-action"
            onClick={() => props.setSearchOpen(true)}
            type="button"
          >
            <Icon name="search" size={16} />
          </button>
        </Tooltip>
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
