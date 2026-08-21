import { createCopyFeedback, fuzzySearch, ICON_NAMES, Icon, Tooltip } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import "./Settings.css";
import "./SettingsIconsTab.css";

export default function SettingsIconsTab() {
  const [query, setQuery] = createSignal("");
  const [copyError, setCopyError] = createSignal(false);
  const [copiedKey, copy] = createCopyFeedback(1200, () => setCopyError(true));
  const copyIconName = (name: string) => {
    setCopyError(false);
    void copy(name, name);
  };

  const filtered = createMemo(() =>
    fuzzySearch(ICON_NAMES, { query: query(), text: (name) => name }),
  );

  return (
    <>
      <h2>Icons</h2>

      <div class="settings-section">
        <Show when={copyError()}>
          <div class="settings-account-error">Couldn't copy to the clipboard.</div>
        </Show>
        <input
          class="settings-status-input debug-icon-search"
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Filter icons…"
          type="text"
          value={query()}
        />
        <div class="debug-icon-grid">
          <For each={filtered()}>
            {(name) => (
              <Tooltip class="debug-icon-tooltip" content={name}>
                <button
                  aria-label={name}
                  class="debug-icon-cell btn-reset flex-col"
                  onClick={() => copyIconName(name)}
                  type="button"
                >
                  <Icon name={copiedKey() === name ? "check" : name} size={20} />
                  <span class="debug-icon-cell-name">{name}</span>
                </button>
              </Tooltip>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
