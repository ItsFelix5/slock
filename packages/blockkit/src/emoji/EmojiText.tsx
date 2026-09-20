import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { useEmojiFreeze } from "../context";
import { decodeTextEntities } from "../entities";
import { EMOJI_TOKEN_RE, resolveStandardEmoji } from "./emoji";
import { emojiAliasTarget, emojiUrl, loadCustomEmoji } from "./emojiCache";
import "./EmojiText.css";

type Part = { type: "text"; value: string } | { type: "emoji"; name: string };

function splitParts(text: string): Part[] {
  const result: Part[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(EMOJI_TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) result.push({ type: "text", value: text.slice(lastIndex, index) });
    result.push({ name: match[1], type: "emoji" });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) result.push({ type: "text", value: text.slice(lastIndex) });
  return result;
}

function StillEmojiImg(props: { name: string; url: string; onError?: () => void }) {
  let canvas: HTMLCanvasElement | undefined;
  createEffect(() => {
    const { url } = props;
    const img = new Image();
    img.onload = () => canvas?.getContext("2d")?.drawImage(img, 0, 0, 40, 40);
    img.onerror = () => props.onError?.();
    img.src = url;
  });
  return (
    <canvas
      aria-label={`:${props.name}:`}
      class="emoji-img"
      data-emoji-name={props.name}
      height={40}
      ref={canvas}
      role="img"
      title={`:${props.name}:`}
      width={40}
    />
  );
}

function HoverEmojiImg(props: { name: string; url: string; onError?: () => void }) {
  return (
    <span class="emoji-img emoji-hover-freeze" data-emoji-name={props.name}>
      <StillEmojiImg name={props.name} onError={props.onError} url={props.url} />
      <img
        alt={`:${props.name}:`}
        class="emoji-img emoji-hover-live"
        data-emoji-name={props.name}
        onError={props.onError}
        src={props.url}
        title={`:${props.name}:`}
      />
    </span>
  );
}

export default function EmojiText(props: { text: string }) {
  const freeze = useEmojiFreeze();
  const text = createMemo(() => props.text);
  const parts = createMemo(() => splitParts(decodeTextEntities(text())));
  return (
    <For each={parts()}>
      {(part) => {
        if (part.type === "text") return <>{part.value}</>;

        const rawUrl = createMemo(() => emojiUrl(part.name));
        const [broken, setBroken] = createSignal(false);
        const url = createMemo(() => (broken() ? undefined : rawUrl()));
        const unicode = createMemo(() => {
          const alias = emojiAliasTarget(part.name);
          return (
            resolveStandardEmoji(part.name) ?? (alias ? resolveStandardEmoji(alias) : undefined)
          );
        });
        const loading = createMemo(() => !unicode() && url() === undefined);
        createEffect(() => {
          rawUrl();
          setBroken(false);
        });
        createEffect(() => {
          if (!unicode() && url() === undefined) void loadCustomEmoji();
        });
        return (
          <Show
            fallback={
              unicode() ? (
                <span class="emoji">{unicode()}</span>
              ) : loading() ? (
                <span class="emoji-img emoji-placeholder" data-emoji-name={part.name} />
              ) : (
                `:${part.name}:`
              )
            }
            when={url()}
          >
            {(u) => {
              const onError = () => setBroken(true);
              if (freeze === "still")
                return <StillEmojiImg name={part.name} onError={onError} url={u()} />;
              if (freeze === "hover")
                return <HoverEmojiImg name={part.name} onError={onError} url={u()} />;
              return (
                <img
                  alt={`:${part.name}:`}
                  class="emoji-img"
                  data-emoji-name={part.name}
                  onError={onError}
                  src={u()}
                  title={`:${part.name}:`}
                />
              );
            }}
          </Show>
        );
      }}
    </For>
  );
}
