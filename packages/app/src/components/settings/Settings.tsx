import { Icon, Overlay, Tooltip, useEscapeClose } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import SettingsAccountTab from "./SettingsAccountTab";
import SettingsAppearanceTab from "./SettingsAppearanceTab";
import SettingsDebugTab from "./SettingsDebugTab";
import SettingsNotificationsTab from "./SettingsNotificationsTab";
import "./Settings.css";

type Tab = "account" | "notifications" | "appearance" | "debugging";

const TABS: { key: Tab; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "debugging", label: "Debugging" },
];

export default function Settings(props: { onClose: () => void }) {
  useEscapeClose(props.onClose);

  const [tab, setTab] = createSignal<Tab>("notifications");

  return (
    <Overlay onClose={props.onClose}>
      <div class="settings-card modal-card">
        <Tooltip content="Close">
          <button
            aria-label="Close"
            class="panel-close-btn floating"
            onClick={props.onClose}
            type="button"
          >
            <Icon name="close" size={12} />
          </button>
        </Tooltip>

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

          <Show when={tab() === "debugging"}>
            <SettingsDebugTab />
          </Show>
        </div>
      </div>
    </Overlay>
  );
}
