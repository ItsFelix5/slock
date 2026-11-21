import { decodeTextEntities } from "@slock/slack";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { useEmojiFreeze } from "../context";
import { EMOJI_TOKEN_RE, resolveStandardEmoji } from "./emoji";
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

export default function EmojiText(props: { text: string }) {
  const freeze = useEmojiFreeze();
  const emoji = useEmojiSource();
  const parts = createMemo(() => splitParts(decodeTextEntities(props.text)));
  return (
    <For each={parts()}>
      {(part) => {
        if (part.type === "text") return <>{part.value}</>;

        const rawUrl = createMemo(() => emoji.url(part.name));
        const [brokenUrl, setBrokenUrl] = createSignal<string | null>();
        const url = createMemo(() => {
          const candidate = rawUrl();
          return candidate === brokenUrl() ? undefined : candidate;
        });
        const unicode = createMemo(() => {
          const alias = emoji.aliasTarget(part.name);
          return (
            resolveStandardEmoji(part.name) ?? (alias ? resolveStandardEmoji(alias) : undefined)
          );
        });
        const loading = createMemo(() => !unicode() && url() === undefined);
        createEffect(
          () => !unicode() && url() === undefined && !emoji.failed(),
          (needsLoad) => {
            if (needsLoad) void emoji.load();
          },
        );
        return (
          <Show
            fallback={
              unicode() ? (
                <span class="emoji" data-emoji-name={part.name}>
                  {unicode()}
                </span>
              ) : loading() ? (
                <span class="emoji-img emoji-placeholder" data-emoji-name={part.name} />
              ) : (
                <span class="emoji-missing">{`:${part.name}:`}</span>
              )
            }
            when={url()}
          >
            {(u) => {
              const onError = () => setBrokenUrl(rawUrl());
              return (
                <Show
                  fallback={
                    <img
                      alt={`:${part.name}:`}
                      class="emoji-img"
                      data-emoji-name={part.name}
                      decoding="async"
                      onError={onError}
                      src={u()}
                      title={`:${part.name}:`}
                    />
                  }
                  when={freeze()}
                >
                  <StillEmojiImg name={part.name} onError={onError} url={u()} />
                </Show>
              );
            }}
          </Show>
        );
      }}
    </For>
  );
}
