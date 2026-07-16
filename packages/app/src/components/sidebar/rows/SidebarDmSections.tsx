import type { DirectMessage } from "@slock/slack-api";
import { Icon } from "@slock/ui";
import { For, Show } from "solid-js";
import { DmRow } from "./SidebarRows";

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
      <Show when={props.peopleDms().length > 0 || !props.unreadsOnly()}>
        <div class="sidebar-section">
          <div class="sidebar-section-header flex-align-center">
            <button
              class="sidebar-section-header-btn btn-reset flex-align-center text-muted text-sm"
              onClick={() => props.setDmsOpen(!props.dmsOpen())}
              type="button"
            >
              <span class="sidebar-caret" classList={{ collapsed: !props.dmsOpen() }}>
                <Icon name="caret-down-filled" size={10} />
              </span>
              Direct messages
            </button>
          </div>
          <div>
            <For each={props.peopleDms()}>
              {(dm) => (
                <Show when={props.dmsOpen() || (dm.mentions ?? 0) > 0}>
                  <DmRow dm={dm} />
                </Show>
              )}
            </For>
          </div>
        </div>
      </Show>
      <Show when={props.appDms().length > 0}>
        <div class="sidebar-section">
          <div class="sidebar-section-header flex-align-center">
            <button
              class="sidebar-section-header-btn btn-reset flex-align-center text-muted text-sm"
              onClick={() => props.setAppsOpen(!props.appsOpen())}
              type="button"
            >
              <span class="sidebar-caret" classList={{ collapsed: !props.appsOpen() }}>
                <Icon name="caret-down-filled" size={10} />
              </span>
              Apps
            </button>
          </div>
          <div>
            <For each={props.appDms()}>
              {(dm) => (
                <Show when={props.appsOpen() || (dm.mentions ?? 0) > 0}>
                  <DmRow dm={dm} />
                </Show>
              )}
            </For>
          </div>
        </div>
      </Show>
    </>
  );
}
