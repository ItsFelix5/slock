import type { BrowsableChannel } from "@slock/slack-api";
import { fetchBrowsableChannels } from "@slock/slack-api";
import {
  createDebouncedRequest,
  fuzzySearch,
  Icon,
  listNavigationIndex,
  scrollActiveListOption,
  useClickOutside,
  useEscapeClose,
} from "@slock/ui";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  Show,
} from "solid-js";
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
  const [searchError, setSearchError] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal<number | null>(0);
  const listboxId = createUniqueId();
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let listRef: HTMLDivElement | undefined;

  useEscapeClose(props.onClose);
  useClickOutside(".compose-picker", props.onClose);

  const excludedChannelIds = createMemo(() => new Set(props.excludeChannelIds ?? []));
  const remoteRequest = createDebouncedRequest(
    async (query) =>
      (await fetchBrowsableChannels(query)).filter(
        (channel) => !excludedChannelIds().has(channel.id),
      ),
    {
      onError: () => setSearchError(true),
      onPendingChange: setSearching,
      onReset: () => {
        setRemoteResults([]);
        setSearchError(false);
      },
      onResult: setRemoteResults,
    },
  );
  onCleanup(() => {
    remoteRequest.dispose();
  });

  const localChannels = createMemo<PickerChannel[]>(() =>
    store.channels
      .channels()
      .filter((c) => !excludedChannelIds().has(c.id))
      .map((c) => ({ id: c.id, name: channelDisplayName(c), private: c.private })),
  );

  const onInput = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    remoteRequest.run(value);
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
  createEffect(() => {
    const count = channels().length;
    const current = activeIndex();
    if (count === 0) setActiveIndex(null);
    else if (current === null || current >= count) setActiveIndex(0);
  });
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const activeOptionId = () => {
    const index = activeIndex();
    return index === null ? undefined : optionId(index);
  };
  createEffect(() => {
    activeIndex();
    scrollActiveListOption(() => listRef);
  });
  const onKeyDown = (event: KeyboardEvent) => {
    const next = listNavigationIndex(event.key, activeIndex(), channels().length);
    if (next !== undefined) {
      event.preventDefault();
      setActiveIndex(next);
      return;
    }
    if (event.key !== "Enter" || event.isComposing) return;
    const index = activeIndex();
    const channel = index === null ? undefined : channels()[index];
    if (!channel) return;
    event.preventDefault();
    props.onSelect(channel.id);
  };

  return (
    <div class="compose-picker">
      <input
        aria-activedescendant={activeOptionId()}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={true}
        aria-label="Find a channel"
        autofocus
        autocomplete="off"
        class="compose-picker-input"
        onInput={(e) => onInput(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        placeholder="Find a channel…"
        role="combobox"
        spellcheck={false}
        type="text"
        value={query()}
      />
      <div
        aria-busy={searching()}
        aria-label="Channel suggestions"
        class="compose-picker-list"
        id={listboxId}
        ref={listRef}
        role="listbox"
      >
        <Show
          fallback={
            <div class="compose-picker-empty" role="status">
              {searching() ? "Searching…" : searchError() ? "Couldn’t load channels" : "No matches"}
            </div>
          }
          when={channels().length > 0}
        >
          <For each={channels()}>
            {(c, index) => (
              <button
                aria-selected={activeIndex() === index()}
                class="compose-picker-row btn-reset flex-align-center"
                classList={{ active: activeIndex() === index() }}
                id={optionId(index())}
                onClick={() => props.onSelect(c.id)}
                onMouseEnter={() => setActiveIndex(index())}
                role="option"
                tabIndex={-1}
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
