import {
  clearKeybindOverride,
  comboLabel,
  confirmDialog,
  Icon,
  inside,
  KeybindField,
  listNavigationIndex,
  listShortcuts,
  resetAllKeybinds,
  rovingTabIndex,
  SHORTCUT_GROUPS,
  type ShortcutCombo,
  type ShortcutInfo,
  setKeybindOverride,
  shortcutConflicts,
  useCancelShortcut,
  useConfirmShortcut,
  useKeybindRecorder,
  useListShortcuts,
  useNavigationShortcuts,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, Index, onMount, Show } from "solid-js";
import "./Settings.css";

function includesText(text: string, query: string) {
  return text.toLowerCase().includes(query);
}

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
          .join(", ")}
        . Only the most recent one wins.
      </div>
    </Show>
  );
}

function ShortcutRow(props: { info: ShortcutInfo }) {
  return (
    <div class="settings-list-row flex-between">
      <div class="settings-list-row-name">
        <div>{props.info.label}</div>
        <ConflictNote info={props.info} />
      </div>
      <KeybindField
        combo={props.info.combo}
        isCustom={props.info.isCustom}
        label={props.info.label}
        onChange={(combo) => setKeybindOverride(props.info.id, combo)}
        onReset={() => clearKeybindOverride(props.info.id)}
      />
    </div>
  );
}

export default function SettingsKeybindsTab() {
  const [query, setQuery] = createSignal("");
  const [keyCombo, setKeyCombo] = createSignal<ShortcutCombo | null>(null);
  let searchRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const finder = useKeybindRecorder((combo) => {
    setKeyCombo(combo);
    setQuery(combo ? comboLabel(combo) : "");
    searchRef?.focus();
  });

  const text = () => query().trim().toLowerCase();

  const groups = createMemo(() => {
    const combo = keyCombo();
    const ids = combo ? new Set(shortcutConflicts("", combo).map((s) => s.id)) : null;
    const shortcuts = listShortcuts().filter((info) =>
      ids
        ? ids.has(info.id)
        : !text() || includesText(info.label, text()) || includesText(info.keys, text()),
    );
    return SHORTCUT_GROUPS.map((label) => ({
      label,
      shortcuts: shortcuts.filter((info) => info.group === label),
    })).filter((group) => group.shortcuts.length > 0);
  });

  const navRows = () => [...(listRef?.querySelectorAll<HTMLElement>("[data-nav-row]") ?? [])];

  createEffect(() => {
    groups();
    queueMicrotask(() => {
      const rows = navRows();
      rovingTabIndex(
        rows,
        Math.max(
          document.activeElement instanceof HTMLElement ? rows.indexOf(document.activeElement) : -1,
          0,
        ),
      );
    });
  });

  onMount(() => {
    if (!document.activeElement?.closest('[role="tablist"]')) searchRef?.focus();
  });

  function onInput(value: string) {
    setKeyCombo(null);
    setQuery(value);
  }

  const focusFirstRow = () => navRows()[0]?.focus();
  useNavigationShortcuts({ directions: ["down"], move: focusFirstRow, root: () => searchRef });
  useConfirmShortcut(focusFirstRow, {
    enabled: () => groups().length > 0,
    target: inside(() => searchRef),
  });
  useCancelShortcut(() => onInput(""), {
    enabled: () => !!query(),
    target: inside(() => searchRef),
  });
  useListShortcuts({
    move: (direction) => {
      const rows = navRows();
      const active = document.activeElement;
      const current = active instanceof HTMLElement ? rows.indexOf(active) : -1;
      if (current < 0) return;
      if (direction === "up" && current === 0) {
        searchRef?.focus();
        return;
      }
      const next = listNavigationIndex(direction, current, rows.length);
      if (next !== undefined) rows[next]?.focus();
    },
    root: () => listRef,
  });

  function redirectTypingToSearch(e: KeyboardEvent) {
    const printable = e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (printable && e.target instanceof HTMLElement && navRows().includes(e.target)) {
      searchRef?.focus();
    }
  }

  function onListFocusIn(e: FocusEvent) {
    const rows = navRows();
    const current = e.target instanceof HTMLElement ? rows.indexOf(e.target) : -1;
    if (current >= 0) rovingTabIndex(rows, current);
  }

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
        <button class="settings-status-clear btn-reset busy" onClick={resetAll} type="button">
          Reset all
        </button>
      </div>

      <div class="settings-add-row flex-align-center">
        <input
          aria-label="Search shortcuts"
          class="text-field"
          onInput={(e) => onInput(e.currentTarget.value)}
          placeholder={finder.recording() ? "Press the keys to look up" : "Search by name or key"}
          ref={searchRef}
          type="text"
          value={query()}
        />
        <button
          aria-pressed={finder.recording()}
          class="settings-status-clear settings-keybind-find btn-reset flex-align-center busy"
          onClick={finder.start}
          type="button"
        >
          <Icon name="keyboard" size={14} />
          Find by keys
        </button>
      </div>

      <div onFocusIn={onListFocusIn} onKeyDown={redirectTypingToSearch} ref={listRef}>
        <Index each={groups()}>
          {(group) => (
            <div class="settings-section">
              <div class="settings-row-label">{group().label}</div>
              <div class="settings-list flex-col">
                <Index each={group().shortcuts}>{(info) => <ShortcutRow info={info()} />}</Index>
              </div>
            </div>
          )}
        </Index>
      </div>

      <Show when={groups().length === 0}>
        <div aria-live="polite" class="settings-list-empty text-dim">
          <Show when={keyCombo()} fallback={<>No shortcuts match "{query().trim()}".</>}>
            {(combo) => <>Nothing uses {comboLabel(combo())}.</>}
          </Show>
        </div>
      </Show>
    </>
  );
}
