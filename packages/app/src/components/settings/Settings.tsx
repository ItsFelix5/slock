import { debugMode, Modal, ModalCloseButton, useTabStripShortcuts } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { store } from "../../lib/store";
import "./Settings.css";
import "./Settings.responsive.css";
import SettingsAccountTab from "./SettingsAccountTab";
import SettingsAppearanceTab from "./SettingsAppearanceTab";
import SettingsIconsTab from "./SettingsIconsTab";
import SettingsKeybindsTab from "./SettingsKeybindsTab";
import SettingsNotificationsTab from "./SettingsNotificationsTab";
import SettingsTemplatesTab from "./SettingsTemplatesTab";

export type SettingsTab =
  | "account"
  | "notifications"
  | "appearance"
  | "keybinds"
  | "templates"
  | "icons";

const BASE_TABS: { key: SettingsTab; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "keybinds", label: "Keybinds" },
];

const TEMPLATES_TAB = { key: "templates" as const, label: "Templates" };
const ICONS_TAB = { key: "icons" as const, label: "Icons" };

export default function Settings(props: { initialTab?: SettingsTab; onClose: () => void }) {
  const [tab, setTab] = createSignal<SettingsTab>(props.initialTab ?? "account");
  const tabs = createMemo(() => {
    const hasTemplates = store.composerTemplates.templates().length > 0;
    const list = hasTemplates ? [...BASE_TABS, TEMPLATES_TAB] : BASE_TABS;
    return debugMode() ? [...list, ICONS_TAB] : list;
  });
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  let tabListRef: HTMLDivElement | undefined;
  useTabStripShortcuts({
    activate: (next, nextIndex) => {
      setTab(next.key);
      tabButtonRefs[nextIndex]?.focus();
    },
    items: tabs,
    orientation: "vertical",
    root: () => tabListRef,
  });

  return (
    <Modal ariaLabel="Settings" class="settings-card" onClose={props.onClose}>
      <ModalCloseButton class="floating" onClose={props.onClose} />

      <div
        aria-orientation="vertical"
        class="settings-nav flex-col"
        ref={tabListRef}
        role="tablist"
      >
        <For each={tabs()}>
          {(t, i) => (
            <button
              aria-selected={tab() === t.key}
              class="settings-nav-btn btn-reset"
              classList={{ active: tab() === t.key }}
              onClick={() => setTab(t.key)}
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

        <Show when={tab() === "templates"}>
          <SettingsTemplatesTab />
        </Show>

        <Show when={debugMode() && tab() === "icons"}>
          <SettingsIconsTab />
        </Show>
      </div>
    </Modal>
  );
}
