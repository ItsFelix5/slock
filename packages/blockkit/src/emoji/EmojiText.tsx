import { createMemo, For, Show } from "solid-js";
import { resolveStandardEmoji } from "./emoji";
import { emojiUrl } from "./emojiCache";
import "./EmojiText.css";

const EMOJI_RE = /:([a-z0-9_+-]+):/gi;

type Part = { type: "text"; value: string } | { type: "emoji"; name: string };

function splitParts(text: string): Part[] {
  const result: Part[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(EMOJI_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) result.push({ type: "text", value: text.slice(lastIndex, index) });
    result.push({ type: "emoji", name: match[1] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) result.push({ type: "text", value: text.slice(lastIndex) });
  return result;
}

export default function EmojiText(props: { text: string }) {
  return (
    <For each={splitParts(props.text)}>
      {(part) => {
        if (part.type === "text") return <>{part.value}</>;
        // Workspace custom emoji can override standard names, so check it first;
        // while that's resolving (or if it resolves to nothing), fall back to the
        // standard unicode glyph so known emoji never flash as raw `:name:` text.
        const url = createMemo(() => emojiUrl(part.name));
        const unicode = resolveStandardEmoji(part.name);
        return (
          <Show
            when={url()}
            fallback={unicode ? <span class="emoji">{unicode}</span> : `:${part.name}:`}
          >
            {(u) => (
              <img class="emoji-img" src={u()} alt={`:${part.name}:`} title={`:${part.name}:`} />
            )}
          </Show>
        );
      }}
    </For>
  );
}
