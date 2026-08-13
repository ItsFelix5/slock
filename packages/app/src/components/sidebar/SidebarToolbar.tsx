import type { SlackFile } from "@slock/slack-api";
import { Avatar, IconButton, Skeleton } from "@slock/ui";
import { createSignal, lazy, Show } from "solid-js";
import FileDetailModal from "../channel/FileDetailModal";
import GlobalSearch from "../search/GlobalSearch";
import DndButton from "./dnd/DndButton";
import type { SidebarContext } from "./sidebarCategories";

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
  const [openFile, setOpenFile] = createSignal<SlackFile>();
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
        <GlobalSearch onClose={() => props.setSearchOpen(false)} onFile={setOpenFile} />
      </Show>
      <Show when={openFile()}>
        {(file) => <FileDetailModal file={file()} onClose={() => setOpenFile()} />}
      </Show>
      <Show when={props.settingsOpen()}>
        <Settings onClose={() => props.setSettingsOpen(false)} />
      </Show>
    </>
  );
}
