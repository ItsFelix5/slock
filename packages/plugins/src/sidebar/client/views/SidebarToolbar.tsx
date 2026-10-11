import { Slot, service } from "@slock/core/solid";
import { Avatar, Skeleton } from "@slock/ui";
import { Show } from "solid-js";

export default function SidebarToolbar() {
  const users = service("users");
  return (
    <div class="sidebar-top flex-align-center">
      <Show
        fallback={
          <div class="sidebar-me sidebar-me-skeleton flex-align-center">
            <Skeleton height={32} radius={8} width={32} />
            <Skeleton height={14} width={90} />
          </div>
        }
        when={users.currentUser()}
      >
        {(user) => (
          <button
            class="sidebar-me btn-reset flex-align-center"
            onClick={() => users.openUserProfile(user().id)}
            type="button"
          >
            <Avatar showPresence size="medium" user={user()} />
            <span class="sidebar-me-name truncate">{user().name}</span>
          </button>
        )}
      </Show>
      <Slot point="sidebar.toolbar" />
    </div>
  );
}
