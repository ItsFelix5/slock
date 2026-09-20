import { debugMode, Modal, ModalCloseButton, tabStripKeyDown } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import "./Settings.css";
import "./Settings.responsive.css";
import SettingsAccountTab from "./SettingsAccountTab";
import SettingsAppearanceTab from "./SettingsAppearanceTab";
import SettingsIconsTab from "./SettingsIconsTab";
import SettingsKeybindsTab from "./SettingsKeybindsTab";
import SettingsNotificationsTab from "./SettingsNotificationsTab";

export type SettingsTab = "account" | "notifications" | "appearance" | "keybinds" | "icons";

const BASE_TABS: { key: SettingsTab; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "keybinds", label: "Keybinds" },
];

const ICONS_TAB = { key: "icons" as const, label: "Icons" };

export default function Settings(props: { initialTab?: SettingsTab; onClose: () => void }) {
  const [tab, setTab] = createSignal<SettingsTab>(props.initialTab ?? "account");
  const tabs = createMemo(() => (debugMode() ? [...BASE_TABS, ICONS_TAB] : BASE_TABS));
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];

  return (
    <Modal ariaLabel="Settings" class="settings-card" onClose={props.onClose}>
      <ModalCloseButton class="floating" onClose={props.onClose} />

      <div aria-orientation="vertical" class="settings-nav flex-col" role="tablist">
        <For each={tabs()}>
          {(t, i) => (
            <button
              aria-selected={tab() === t.key}
              class="settings-nav-btn btn-reset"
              classList={{ active: tab() === t.key }}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) =>
                tabStripKeyDown(
                  e,
                  tabs(),
                  i(),
                  (next, nextIndex) => {
                    setTab(next.key);
                    tabButtonRefs[nextIndex]?.focus();
                  },
                  "vertical",
                )
              }
              ref={(el) => {
                tabButtonRefs[i()] = el;
              }}
              role="tab"
              tabIndex={tab() === t.key ? 0 : -1}
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

        <Show when={tab() === "keybinds"}>
          <SettingsKeybindsTab />
        </Show>

        <Show when={debugMode() && tab() === "icons"}>
          <SettingsIconsTab />
        </Show>
      </div>
    </Modal>
  );
}
