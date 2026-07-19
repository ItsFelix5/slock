import type { BrowsableChannel } from "@slock/slack-api";
import { fetchBrowsableChannels } from "@slock/slack-api";
import { fuzzySearch, Icon, useClickOutside, useEscapeClose } from "@slock/ui";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { channelDisplayName, store } from "../../../lib/store";
import "./ComposeUserPicker.css";

interface PickerChannel {
  id: string;
  name: string;
  private: boolean;
}

export default function ComposeChannelPicker(props: {
  excludeChannelIds?: string[];
  onSelect: (channelId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = createSignal("");
  const [remoteResults, setRemoteResults] = createSignal<BrowsableChannel[]>([]);
  const [searching, setSearching] = createSignal(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  useEscapeClose(props.onClose);
  useClickOutside(".compose-picker", props.onClose);

  onMount(() => {
    onCleanup(() => clearTimeout(debounceTimer));
  });

  const excludedChannelIds = createMemo(() => new Set(props.excludeChannelIds ?? []));

  const localChannels = createMemo<PickerChannel[]>(() =>
    store.channels
      .channels()
      .filter((c) => !excludedChannelIds().has(c.id))
      .map((c) => ({ id: c.id, name: channelDisplayName(c), private: c.private })),
  );

  const onInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceTimer);
    const q = value.trim();
    if (!q) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++requestId;
    debounceTimer = setTimeout(async () => {
      const found = (await fetchBrowsableChannels(q)).filter(
        (c) => !excludedChannelIds().has(c.id),
      );
      if (id === requestId) {
        setRemoteResults(found);
        setSearching(false);
      }
    }, 250);
  };

  const channels = createMemo(() => {
    const merged = new Map<string, PickerChannel>();
    for (const c of localChannels()) merged.set(c.id, c);
    for (const c of remoteResults()) {
      if (!merged.has(c.id)) merged.set(c.id, { id: c.id, name: c.name, private: c.private });
    }
    const pool = [...merged.values()];
    const q = query().trim();
    if (!q) return pool.slice(0, 40);
    return fuzzySearch(pool, {
      frequency: (c) => store.preferences.frecencyScore(c.id),
      query: q,
      text: (c) => c.name,
    }).slice(0, 40);
  });

  return (
    <div class="compose-picker">
      <input
        autofocus
        class="compose-picker-input"
        onInput={(e) => onInput(e.currentTarget.value)}
        placeholder="Find a channel…"
        type="text"
        value={query()}
      />
      <div class="compose-picker-list">
        <Show
          fallback={
            <div class="compose-picker-empty">{searching() ? "Searching…" : "No matches"}</div>
          }
          when={channels().length > 0}
        >
          <For each={channels()}>
            {(c) => (
              <button
                class="compose-picker-row btn-reset flex-align-center"
                onClick={() => props.onSelect(c.id)}
                type="button"
              >
                <Show fallback="#" when={c.private}>
                  <Icon name="lock" size={12} />
                </Show>
                {c.name}
              </button>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
