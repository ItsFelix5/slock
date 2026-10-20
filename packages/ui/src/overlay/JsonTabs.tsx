import { createSignal, For, Show } from "solid-js";
import { useTabStripShortcuts } from "../useNavShortcuts";
import JsonTree from "./JsonTree";
import "./JsonTabs.css";

const OPEN_DEPTH = 4;

function topLevelEntries(value: unknown): [string, unknown][] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value).filter(([, child]) => child !== undefined);
}

export default function JsonTabs(props: { value: unknown }) {
  const entries = () => topLevelEntries(props.value);
  const keys = () => entries().map(([key]) => key);
  const [selected, setSelected] = createSignal<string>();
  const tabButtonRefs: (HTMLButtonElement | undefined)[] = [];
  let tabListRef: HTMLDivElement | undefined;

  const active = () => {
    const current = selected();
    return current && keys().includes(current) ? current : keys()[0];
  };
  const activeValue = () =>
    entries().length === 0 ? props.value : entries().find(([key]) => key === active())?.[1];

  useTabStripShortcuts({
    activate: (key, index) => {
      setSelected(key);
      tabButtonRefs[index]?.focus();
    },
    items: keys,
    root: () => tabListRef,
  });

  return (
    <>
      <Show when={keys().length > 1}>
        <div class="json-tabs" ref={tabListRef} role="tablist">
          <For each={keys()}>
            {(key, index) => (
              <button
                aria-selected={active() === key}
                class="json-tab btn-reset"
                classList={{ active: active() === key }}
                onClick={() => setSelected(key)}
                ref={(el) => {
                  tabButtonRefs[index()] = el;
                }}
                role="tab"
                tabIndex={active() === key ? 0 : -1}
                type="button"
              >
                {key}
              </button>
            )}
          </For>
        </div>
      </Show>
      <div class="json-tabs-content">
        <JsonTree openDepth={OPEN_DEPTH} value={activeValue()} />
      </div>
    </>
  );
}
