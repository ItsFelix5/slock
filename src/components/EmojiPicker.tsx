import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { STANDARD_EMOJI } from '../emoji';
import { EMOJI_CATEGORIES } from '../emojiCategories';
import { emojiUrl, customEmojiNames } from '../emojiCache';
import { useEscapeClose } from '../useEscapeClose';
import './EmojiPicker.css';

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

  const customNames = createMemo(() => customEmojiNames().filter((n) => emojiUrl(n)).sort());

  const filteredCategories = createMemo(() => {
    const q = query().trim().toLowerCase();
    const custom = customNames();
    const groups = [...EMOJI_CATEGORIES, ...(custom.length ? [{ label: 'Custom', names: custom }] : [])];
    if (!q) return groups;
    return groups
      .map((g) => ({ label: g.label, names: g.names.filter((n) => n.includes(q)) }))
      .filter((g) => g.names.length > 0);
  });

  const isEmpty = createMemo(() => filteredCategories().every((g) => g.names.length === 0));

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
          <For each={filteredCategories()}>
            {(group) => (
              <Show when={group.names.length}>
                <div class="emoji-picker-category-label">{group.label}</div>
                <div class="emoji-picker-grid">
                  <For each={group.names}>
                    {(name) => {
                      const url = createMemo(() => emojiUrl(name));
                      const unicode = STANDARD_EMOJI[name];
                      return (
                        <button
                          type="button"
                          class="emoji-picker-btn"
                          title={`:${name}:`}
                          onClick={() => props.onSelect(name)}
                        >
                          <Show when={url()} fallback={unicode ?? '❔'}>
                            {(u) => <img src={u()} alt={name} />}
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
