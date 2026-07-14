import { Icon, Overlay, useEscapeClose } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import SettingsAccountTab from "./SettingsAccountTab";
import SettingsAppearanceTab from "./SettingsAppearanceTab";
import SettingsDebugTab from "./SettingsDebugTab";
import SettingsNotificationsTab from "./SettingsNotificationsTab";
import SettingsShortcutsTab from "./SettingsShortcutsTab";
import "./Settings.css";

type Tab = "account" | "notifications" | "appearance" | "shortcuts" | "debugging";

const TABS: { key: Tab; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "shortcuts", label: "Shortcuts" },
  { key: "debugging", label: "Debugging" },
];

export default function Settings(props: { onClose: () => void }) {
  useEscapeClose(props.onClose);

  const [tab, setTab] = createSignal<Tab>("notifications");

  return (
    <Overlay onClose={props.onClose}>
      <div class="settings-card modal-card">
        <button
          class="panel-close-btn floating"
          onClick={props.onClose}
          title="Close"
          type="button"
        >
          <Icon name="close" size={12} />
        </button>

        <div class="settings-nav flex-col">
          <For each={TABS}>
            {(t) => (
              <button
                class="settings-nav-btn btn-reset"
                classList={{ active: tab() === t.key }}
                onClick={() => setTab(t.key)}
                type="button"
              >
                {t.label}
              </button>
            )}
          </For>
        </div>

        <div class="settings-content">
          <Show when={tab() === "account"}>
            <SettingsAccountTab />
          </Show>

          <Show when={tab() === "notifications"}>
            <SettingsNotificationsTab />
          </Show>

          <Show when={tab() === "appearance"}>
            <SettingsAppearanceTab />
          </Show>

          <Show when={tab() === "shortcuts"}>
            <SettingsShortcutsTab />
          </Show>

          <Show when={tab() === "debugging"}>
            <SettingsDebugTab />
          </Show>
        </div>
      </div>
    </Overlay>
  );
}
