import { fuzzySearch, ICON_NAMES, Icon, showToast } from "@slock/ui";
import { createMemo, createSignal, For } from "solid-js";
import "./Settings.css";
import "./SettingsDebugTab.css";

export default function SettingsDebugTab() {
  const [query, setQuery] = createSignal("");

  const filtered = createMemo(() =>
    fuzzySearch(ICON_NAMES, { query: query(), text: (name) => name }),
  );

  const copyName = async (name: string) => {
    await navigator.clipboard.writeText(name);
    showToast(`Copied "${name}"`);
  };

  return (
    <>
      <h2>Debugging</h2>

      <div class="settings-section">
        <div class="settings-row-label">Icon browser</div>
        <div class="settings-row-hint">
          {ICON_NAMES.length} icons available. Click one to copy its name.
        </div>
        <input
          class="settings-status-input debug-icon-search"
          type="text"
          placeholder="Filter icons…"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <div class="debug-icon-grid">
          <For each={filtered()}>
            {(name) => (
              <button
                type="button"
                class="debug-icon-cell"
                title={name}
                onClick={() => copyName(name)}
              >
                <Icon name={name} size={20} />
                <span class="debug-icon-cell-name">{name}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
