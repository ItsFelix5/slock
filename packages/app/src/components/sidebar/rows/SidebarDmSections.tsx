import { Tooltip } from "@slock/ui";
import { For, Show } from "solid-js";
import type { DirectMessage } from "../../../lib/api";
import { DmRow, SidebarSectionCaretRow } from "./sidebar-rows";

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
          <SidebarSectionCaretRow
            badge={
              <Show when={count() > 0 && !props.open()}>
                <Tooltip content={`${count()} unread conversations`}>
                  <span class="sidebar-badge">{count()}</span>
                </Tooltip>
              </Show>
            }
            label={props.label}
            onToggleOpen={() => props.setOpen(!props.open())}
            open={props.open()}
          />
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
