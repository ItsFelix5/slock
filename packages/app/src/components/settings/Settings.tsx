import { Overlay, useEscapeClose } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import SettingsAppearanceTab from "./SettingsAppearanceTab";
import SettingsDebugTab from "./SettingsDebugTab";
import SettingsNotificationsTab from "./SettingsNotificationsTab";
import SettingsProfileTab from "./SettingsProfileTab";
import SettingsShortcutsTab from "./SettingsShortcutsTab";
import "./Settings.css";

type Tab = "profile" | "notifications" | "appearance" | "shortcuts" | "debugging";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "shortcuts", label: "Shortcuts" },
  { key: "debugging", label: "Debugging" },
];

export default function Settings(props: { onClose: () => void }) {
  useEscapeClose(props.onClose);

  const [tab, setTab] = createSignal<Tab>("profile");

  return (
    <Overlay onClose={props.onClose}>
      <div class="settings-card">
        <button type="button" class="settings-close" onClick={props.onClose} title="Close">
          ✕
        </button>

        <div class="settings-nav">
          <For each={TABS}>
            {(t) => (
              <button
                type="button"
                class="settings-nav-btn"
                classList={{ active: tab() === t.key }}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            )}
          </For>
        </div>

        <div class="settings-content">
          <Show when={tab() === "profile"}>
            <SettingsProfileTab />
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
