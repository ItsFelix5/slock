import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { EMOJI_CATEGORIES } from '../emojiCategories';
import { emojiUrl, customEmojiNames } from '../emojiCache';
import { emojiUseScore } from '../store';
import { useEscapeClose } from '../useEscapeClose';
import './EmojiPicker.css';

interface PickerEntry {
  name: string;
  unicode?: string;
  category: string;
  searchText: string;
}

const STANDARD_ENTRIES: PickerEntry[] = EMOJI_CATEGORIES.flatMap((group) =>
  group.entries.map(
    (e): PickerEntry => ({
      name: e.names[0],
      unicode: e.emoji,
      category: group.label,
      searchText: [...e.names, ...e.tags, e.description].join(' ').toLowerCase(),
    }),
  ),
);

const CATEGORY_ORDER = ['Custom', ...EMOJI_CATEGORIES.map((g) => g.label)];
const FREQUENT_LIMIT = 24;

export default function EmojiPicker(props: { onSelect: (name: string) => void; onClose: () => void }) {
  const [query, setQuery] = createSignal('');
  let rootRef: HTMLDivElement | undefined;

  useEscapeClose(props.onClose);

  onMount(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef && !rootRef.contains(e.target as Node)) props.onClose();
    };
    document.addEventListener('mousedown', onDocClick, true);
    onCleanup(() => document.removeEventListener('mousedown', onDocClick, true));
  });

  const customEntries = createMemo<PickerEntry[]>(() =>
    customEmojiNames()
      .filter((n) => emojiUrl(n))
      .map((name) => ({ name, category: 'Custom', searchText: name })),
  );

  const allEntries = createMemo(() => [...customEntries(), ...STANDARD_ENTRIES]);

  // With no search, lead with whatever's actually been picked before — the same
  // frecency signal store.ts tracks for the quick switcher's jump list.
  // Recording a use is the caller's job (see MessageActionsBar's react() and
  // Composer's onSelect) since this component is also used just to insert text.
  const frequent = createMemo(() => {
    if (query().trim()) return [];
    return allEntries()
      .map((e) => ({ e, score: emojiUseScore(e.name) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, FREQUENT_LIMIT)
      .map((x) => x.e);
  });

  const groups = createMemo(() => {
    const q = query().trim().toLowerCase();
    const entries = allEntries();
    const filtered = q ? entries.filter((e) => e.searchText.includes(q)) : entries;
    const byCategory = new Map<string, PickerEntry[]>();
    for (const e of filtered) {
      const list = byCategory.get(e.category) ?? [];
      list.push(e);
      byCategory.set(e.category, list);
    }
    // While searching, rank each category's matches by usage frequency too, so
    // a frequently-picked emoji still surfaces near the top of its group.
    if (q) {
      for (const list of byCategory.values()) list.sort((a, b) => emojiUseScore(b.name) - emojiUseScore(a.name));
    }
    return CATEGORY_ORDER.filter((label) => byCategory.has(label)).map((label) => ({ label, entries: byCategory.get(label)! }));
  });

  const isEmpty = createMemo(() => frequent().length === 0 && groups().every((g) => g.entries.length === 0));

  return (
    <div class="emoji-picker" ref={rootRef}>
      <div class="emoji-picker-search">
        <input
          type="text"
          placeholder="Search emoji…"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          autofocus
        />
      </div>
      <div class="emoji-picker-body">
        <Show when={!isEmpty()} fallback={<div class="emoji-picker-empty">No emoji found</div>}>
          <Show when={frequent().length > 0}>
            <div class="emoji-picker-category-label">Frequently used</div>
            <div class="emoji-picker-grid">
              <For each={frequent()}>{(entry) => <EmojiButton entry={entry} onSelect={props.onSelect} />}</For>
            </div>
          </Show>
          <For each={groups()}>
            {(group) => (
              <Show when={group.entries.length}>
                <div class="emoji-picker-category-label">{group.label}</div>
                <div class="emoji-picker-grid">
                  <For each={group.entries}>{(entry) => <EmojiButton entry={entry} onSelect={props.onSelect} />}</For>
                </div>
              </Show>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

function EmojiButton(props: { entry: PickerEntry; onSelect: (name: string) => void }) {
  const url = createMemo(() => emojiUrl(props.entry.name));
  return (
    <button
      type="button"
      class="emoji-picker-btn"
      title={`:${props.entry.name}:`}
      onClick={() => props.onSelect(props.entry.name)}
    >
      <Show when={url()} fallback={props.entry.unicode ?? '❔'}>
        {(u) => <img src={u()} alt={props.entry.name} />}
      </Show>
    </button>
  );
}
