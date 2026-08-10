import { Modal, ModalCloseButton } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import SettingsAccountTab from "./SettingsAccountTab";
import SettingsAppearanceTab from "./SettingsAppearanceTab";
import SettingsDebugTab from "./SettingsDebugTab";
import SettingsNotificationsTab from "./SettingsNotificationsTab";
import "./Settings.css";
import "./Settings.responsive.css";

type Tab = "account" | "notifications" | "appearance" | "debugging";

const TABS: { key: Tab; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "debugging", label: "Debugging" },
];

export default function Settings(props: { onClose: () => void }) {
  const [tab, setTab] = createSignal<Tab>("notifications");

  return (
    <Modal ariaLabel="Settings" class="settings-card" onClose={props.onClose}>
      <ModalCloseButton class="floating" onClose={props.onClose} />

      <div class="settings-nav flex-col">
        <For each={TABS}>
          {(t) => (
            <button
              aria-pressed={tab() === t.key}
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
    </Modal>
  );
}
