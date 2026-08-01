import type { DirectMessage } from "@slock/slack-api";
import { Icon } from "@slock/ui";
import { For, Show } from "solid-js";
import { DmRow } from "./SidebarRows";

function DmSection(props: {
  count?: () => number;
  dms: () => DirectMessage[];
  label: string;
  open: () => boolean;
  setOpen: (open: boolean) => void;
  showMentionsWhenClosed?: boolean;
  showWhenEmpty?: () => boolean;
}) {
  const count = () => props.count?.() ?? 0;

  return (
    <Show when={props.dms().length > 0 || props.showWhenEmpty?.()}>
      <div class="sidebar-section">
        <div class="sidebar-section-header flex-align-center">
          <button
            aria-expanded={props.open()}
            class="sidebar-section-header-btn btn-reset flex-align-center text-muted text-sm"
            onClick={() => props.setOpen(!props.open())}
            type="button"
          >
            <span class="sidebar-caret">
              <Icon name={props.open() ? "caret-down-filled" : "caret-right-filled"} size={10} />
            </span>
            <span>{props.label}</span>
            <Show when={count() > 0}>
              <span class="sidebar-badge" title={`${count()} unread conversations`}>
                {count()}
              </span>
            </Show>
          </button>
        </div>
        <div>
          <For each={props.dms()}>
            {(dm) => (
              <Show when={props.open() || (props.showMentionsWhenClosed && (dm.mentions ?? 0) > 0)}>
                <DmRow dm={dm} />
              </Show>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

export function SidebarUnreadDmSection(props: {
  unreadDms: () => DirectMessage[];
  unreadDmsOpen: () => boolean;
  setUnreadDmsOpen: (open: boolean) => void;
}) {
  return (
    <DmSection
      count={() => props.unreadDms().length}
      dms={props.unreadDms}
      label="Unread messages"
      open={props.unreadDmsOpen}
      setOpen={props.setUnreadDmsOpen}
    />
  );
}

export default function SidebarDmSections(props: {
  peopleDms: () => DirectMessage[];
  appDms: () => DirectMessage[];
  unreadsOnly: () => boolean;
  dmsOpen: () => boolean;
  setDmsOpen: (open: boolean) => void;
  appsOpen: () => boolean;
  setAppsOpen: (open: boolean) => void;
}) {
  return (
    <>
      <DmSection
        dms={props.peopleDms}
        label="Direct messages"
        open={props.dmsOpen}
        setOpen={props.setDmsOpen}
        showMentionsWhenClosed
        showWhenEmpty={() => !props.unreadsOnly()}
      />
      <DmSection
        dms={props.appDms}
        label="Apps"
        open={props.appsOpen}
        setOpen={props.setAppsOpen}
        showMentionsWhenClosed
      />
    </>
  );
}
