import { Icon } from "@slock/ui";
import { For, Show } from "solid-js";
import { DmRow } from "./SidebarRows";

export default function SidebarDmSections(props: {
  peopleDms: () => any[];
  appDms: () => any[];
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
          <div style={{ display: props.dmsOpen() ? "block" : "none" }}>
            <For each={props.peopleDms()}>{(dm) => <DmRow dm={dm} />}</For>
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
          <div style={{ display: props.appsOpen() ? "block" : "none" }}>
            <For each={props.appDms()}>{(dm) => <DmRow dm={dm} />}</For>
          </div>
        </div>
      </Show>
    </>
  );
}
