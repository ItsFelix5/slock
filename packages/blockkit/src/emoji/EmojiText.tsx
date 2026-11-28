import { decodeTextEntities } from "@slock/slack";
import { createEffect, createMemo, createSignal, For, Match, Switch } from "solid-js";
import { useEmojiFreeze } from "../context";
import { EMOJI_TOKEN_RE, resolveEmojiGlyph } from "./emoji";
import { useEmojiSource } from "./emojiSource";
import "./EmojiText.css";
import { defined } from "@slock/core";
import { STILL_EMOJI_SIZE } from "./stillEmoji";

type Part = { type: "text"; value: string } | { type: "emoji"; name: string };

function splitParts(text: string): Part[] {
  const result: Part[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(EMOJI_TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) result.push({ type: "text", value: text.slice(lastIndex, index) });
    result.push({ name: defined(match[1]), type: "emoji" });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) result.push({ type: "text", value: text.slice(lastIndex) });
  return result;
}

function StillEmojiImg(props: { name: string; url: string; onError?: () => void }) {
  const emoji = useEmojiSource();
  let canvas: HTMLCanvasElement | undefined;
  createEffect(
    () => props.url,
    (url) => {
      let stale = false;
      emoji.still(url).then(
        ({ bitmap, x, y }) => {
          if (!stale) canvas?.getContext("2d")?.drawImage(bitmap, x, y);
        },
        () => {
          if (!stale) props.onError?.();
        },
      );
      return () => {
        stale = true;
      };
    },
  );
  return (
    <canvas
      aria-label={`:${props.name}:`}
      class="emoji-img"
      data-emoji-name={props.name}
      height={STILL_EMOJI_SIZE}
      ref={canvas}
      role="img"
      title={`:${props.name}:`}
      width={STILL_EMOJI_SIZE}
    />
  );
}

export function EmojiGlyph(props: { glyph: string; name: string }) {
  return (
    <span class="emoji" data-emoji-name={props.name} title={`:${props.name}:`}>
      {props.glyph}
    </span>
  );
}

function EmojiPart(props: { name: string }) {
  const freeze = useEmojiFreeze();
  const emoji = useEmojiSource();
  const [brokenUrl, setBrokenUrl] = createSignal<string | null>();
  const url = createMemo(() => {
    const candidate = emoji.url(props.name);
    return candidate === brokenUrl() ? undefined : candidate;
  });
  const unicode = createMemo(() => resolveEmojiGlyph(props.name, emoji));
  createEffect(
    () => !unicode() && url() === undefined && !emoji.failed(),
    (needsLoad) => {
      if (needsLoad) void emoji.load();
    },
  );
  const onError = () => setBrokenUrl(emoji.url(props.name));
  return (
    <Switch fallback={<span class="emoji-missing">{`:${props.name}:`}</span>}>
      <Match when={url()}>
        {(src) =>
          freeze() ? (
            <StillEmojiImg name={props.name} onError={onError} url={src()} />
          ) : (
            <img
              alt={`:${props.name}:`}
              class="emoji-img"
              data-emoji-name={props.name}
              decoding="async"
              onError={onError}
              src={src()}
              title={`:${props.name}:`}
            />
          )
        }
      </Match>
      <Match when={unicode()}>{(glyph) => <EmojiGlyph glyph={glyph()} name={props.name} />}</Match>
      <Match when={url() === undefined}>
        <span class="emoji-img emoji-placeholder" data-emoji-name={props.name} />
      </Match>
    </Switch>
  );
}

export default function EmojiText(props: { text: string }) {
  const parts = createMemo(() => splitParts(decodeTextEntities(props.text)));
  return (
    <For each={parts()}>
      {(part) => (part.type === "text" ? part.value : <EmojiPart name={part.name} />)}
    </For>
  );
}
