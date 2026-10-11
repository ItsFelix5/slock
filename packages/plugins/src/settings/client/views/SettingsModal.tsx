import { usePoint } from "@slock/core/solid";
import { Modal, ModalCloseButton, useTabStripShortcuts } from "@slock/ui";
import { createMemo, createSignal, For } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { SettingsTabItem } from "../api";
import "./SettingsModal.css";
import "./SettingsModal.responsive.css";

export default function SettingsModal(props: { initialTab?: string; onClose: () => void }) {
  const items = usePoint("settings.tab");
  const tabs = createMemo(() => items().filter((tab) => tab.visible?.() ?? true));
  const [selected, setSelected] = createSignal(props.initialTab);
  const active = createMemo(() => tabs().find((tab) => tab.id === selected()) ?? tabs()[0]);
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  let tabListRef: HTMLDivElement | undefined;
  useTabStripShortcuts<SettingsTabItem>({
    activate: (next, nextIndex) => {
      setSelected(next.id);
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
          {(tab, index) => (
            <button
              aria-selected={active()?.id === tab.id}
              class="settings-nav-btn btn-reset"
              classList={{ active: active()?.id === tab.id }}
              onClick={() => setSelected(tab.id)}
              ref={(el) => {
                tabButtonRefs[index()] = el;
              }}
              role="tab"
              tabIndex={active()?.id === tab.id ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>

      <div class="settings-content">
        <Dynamic component={active()?.view} />
      </div>
    </Modal>
  );
}
