import { debugMode, Modal, ModalCloseButton } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import "./Settings.css";
import "./Settings.responsive.css";
import SettingsAccountTab from "./SettingsAccountTab";
import SettingsAppearanceTab from "./SettingsAppearanceTab";
import SettingsIconsTab from "./SettingsIconsTab";
import SettingsNotificationsTab from "./SettingsNotificationsTab";

type Tab = "account" | "notifications" | "appearance" | "icons";

const BASE_TABS: { key: Tab; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
];

const ICONS_TAB = { key: "icons" as const, label: "Icons" };

export default function Settings(props: { onClose: () => void }) {
  const [tab, setTab] = createSignal<Tab>("notifications");
  const tabs = createMemo(() => (debugMode() ? [...BASE_TABS, ICONS_TAB] : BASE_TABS));

  return (
    <Modal ariaLabel="Settings" class="settings-card" onClose={props.onClose}>
      <ModalCloseButton class="floating" onClose={props.onClose} />

      <div class="settings-nav flex-col">
        <For each={tabs()}>
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

        <Show when={debugMode() && tab() === "icons"}>
          <SettingsIconsTab />
        </Show>
      </div>
    </Modal>
  );
}
