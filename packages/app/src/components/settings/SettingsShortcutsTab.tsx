import { For } from "solid-js";
import "./Settings.css";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl/⌘ K", label: "Open the quick switcher (jump to a channel or person)" },
  { keys: "Enter", label: "Send the message in the composer" },
  { keys: "Shift Enter", label: "Insert a new line in the composer" },
  { keys: "Escape", label: "Close whatever panel or dialog is open" },
];

export default function SettingsShortcutsTab() {
  return (
    <>
      <h2>Shortcuts</h2>
      <div class="settings-list flex-col">
        <For each={SHORTCUTS}>
          {(s) => (
            <div class="settings-list-row flex-between">
              <span class="settings-list-row-name flex-align-center">{s.label}</span>
              <kbd class="settings-kbd">{s.keys}</kbd>
            </div>
          )}
        </For>
      </div>
    </>
  );
}
