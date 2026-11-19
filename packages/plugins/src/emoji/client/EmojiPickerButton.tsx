import { emojiUrl } from "@slock/blockkit";
import { Tooltip } from "@slock/ui";
import { Show } from "solid-js";
import type { EmojiEntry } from "./api/emojiSearch";

export default function EmojiPickerButton(props: {
  active: boolean;
  entry: EmojiEntry;
  index: number;
  onSelect: (name: string) => void;
  reactionByName: () => Map<string, boolean>;
}) {
  const url = () => emojiUrl(props.entry.name);
  const mine = () => props.reactionByName().get(props.entry.name) === true;
  const reacted = () => props.reactionByName().has(props.entry.name);
  const tooltip = () => {
    if (mine()) return `:${props.entry.name}: · you reacted`;
    if (reacted()) return `:${props.entry.name}: · already reacted`;
    return `:${props.entry.name}:`;
  };
  return (
    <Tooltip content={tooltip()}>
      <button
        aria-label={`:${props.entry.name}:`}
        class="emoji-picker-btn btn-reset flex-center"
        classList={{ mine: mine(), reacted: reacted() }}
        data-emoji-index={props.index}
        onClick={() => props.onSelect(props.entry.name)}
        tabindex={props.active ? 0 : -1}
        type="button"
      >
        <Show fallback={props.entry.unicode ?? "❔"} when={url()}>
          {(u) => <img alt={props.entry.name} decoding="async" loading="lazy" src={u()} />}
        </Show>
      </button>
    </Tooltip>
  );
}
