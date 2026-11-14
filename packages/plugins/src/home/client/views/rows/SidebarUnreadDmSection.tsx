import type { DirectMessage } from "@slock/types";
import { Tooltip } from "@slock/ui";
import { For, Show } from "solid-js";
import { DmRow } from "./DmRow";
import { SidebarSectionCaretRow } from "./SidebarSectionCaretRow";

export function SidebarUnreadDmSection(props: {
  unreadDms: () => DirectMessage[];
  unreadDmsOpen: () => boolean;
  setUnreadDmsOpen: (open: boolean) => void;
}) {
  return (
    <Show when={props.unreadDms().length > 0}>
      <div class="sidebar-section">
        <div class="sidebar-section-header flex-align-center">
          <SidebarSectionCaretRow
            badge={
              <Show when={!props.unreadDmsOpen()}>
                <Tooltip content={`${props.unreadDms().length} unread conversations`}>
                  <span class="sidebar-badge">{props.unreadDms().length}</span>
                </Tooltip>
              </Show>
            }
            label="Unread messages"
            onToggleOpen={() => props.setUnreadDmsOpen(!props.unreadDmsOpen())}
            open={props.unreadDmsOpen()}
          />
        </div>
        <Show when={props.unreadDmsOpen()}>
          <div>
            <For each={props.unreadDms()}>{(dm) => <DmRow dm={dm} />}</For>
          </div>
        </Show>
      </div>
    </Show>
  );
}
