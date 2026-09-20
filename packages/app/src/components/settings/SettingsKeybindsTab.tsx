import {
  clearKeybindOverride,
  confirmDialog,
  KeybindField,
  listShortcuts,
  resetAllKeybinds,
  type ShortcutInfo,
  type ShortcutScope,
  setKeybindOverride,
  shortcutConflicts,
} from "@slock/ui";
import { createMemo, For, Show } from "solid-js";
import "./Settings.css";

const SCOPE_ORDER: ShortcutScope[] = ["general", "composer", "messages"];
const SCOPE_LABELS: Record<ShortcutScope, string> = {
  composer: "Composer",
  general: "General",
  messages: "Messages",
};

type FixedAction = { keys: string; label: string };

const REFERENCE_ONLY_FIXED_ACTIONS: Partial<Record<ShortcutScope, FixedAction[]>> = {
  composer: [
    { keys: "Enter", label: "Send message" },
    { keys: "Shift Enter", label: "Insert a new line" },
    { keys: "Ctrl B", label: "Bold" },
    { keys: "Ctrl I", label: "Italic" },
    { keys: "Ctrl Shift X", label: "Strikethrough" },
    { keys: "Ctrl Shift C", label: "Inline code" },
  ],
  general: [
    { keys: "Escape", label: "Close the focused pane or dialog" },
    { keys: "Ctrl/⌘ Click", label: "Open a channel, link, or reply in a new split pane" },
  ],
};

function ConflictNote(props: { info: ShortcutInfo }) {
  const conflicts = createMemo(() =>
    props.info.combo ? shortcutConflicts(props.info.id, props.info.combo) : [],
  );
  return (
    <Show when={conflicts().length > 0}>
      <div class="settings-row-meta settings-keybind-conflict">
        Also fires{" "}
        {conflicts()
          .map((c) => `"${c.label}"`)
          .join(", ")}{" "}
        — only the most recent one wins.
      </div>
    </Show>
  );
}

export default function SettingsKeybindsTab() {
  const grouped = createMemo(() => {
    const map = new Map<ShortcutScope, ShortcutInfo[]>();
    for (const info of listShortcuts()) {
      const list = map.get(info.scope);
      if (list) list.push(info);
      else map.set(info.scope, [info]);
    }
    return map;
  });

  async function resetAll() {
    if (
      await confirmDialog({
        title: "Reset all keybinds",
        message: "This puts every shortcut back to its default. Custom bindings are lost.",
        confirmLabel: "Reset all",
        danger: true,
      })
    )
      resetAllKeybinds();
  }

  return (
    <>
      <div class="settings-row flex-between">
        <h2>Keybinds</h2>
        <button class="settings-status-clear btn-reset" onClick={resetAll} type="button">
          Reset all
        </button>
      </div>

      <For each={SCOPE_ORDER}>
        {(scope) => {
          const fixed = REFERENCE_ONLY_FIXED_ACTIONS[scope] ?? [];
          return (
            <Show when={(grouped().get(scope)?.length ?? 0) > 0 || fixed.length > 0}>
              <div class="settings-section">
                <div class="settings-row-label">{SCOPE_LABELS[scope]}</div>
                <div class="settings-list flex-col">
                  <For each={grouped().get(scope) ?? []}>
                    {(info) => (
                      <div class="settings-list-row flex-between">
                        <div class="settings-list-row-name">
                          <div>{info.label}</div>
                          <ConflictNote info={info} />
                        </div>
                        <KeybindField
                          combo={info.combo}
                          isCustom={info.isCustom}
                          label={info.label}
                          onChange={(combo) => setKeybindOverride(info.id, combo)}
                          onReset={() => clearKeybindOverride(info.id)}
                        />
                      </div>
                    )}
                  </For>
                  <For each={fixed}>
                    {(action) => (
                      <div class="settings-list-row flex-between">
                        <div class="settings-list-row-name">{action.label}</div>
                        <kbd class="settings-kbd">{action.keys}</kbd>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          );
        }}
      </For>
    </>
  );
}
