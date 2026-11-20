import { EmojiText } from "@slock/blockkit";
import { Tooltip } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import type { ComposerTrailingProps } from "../../composer/client/api";
import { defineQuery } from "../../query/client/api";
import { isHaiku } from "./haiku/isHaiku";
import "./OrpheusIndicator.css";

const HAIKU_OFF_CHANNEL = "C09MATKQM8C";
const MAX_LENGTH = 300;
const MIN_WORDS = 5;
const WHITESPACE_RE = /\s+/;

const syllableExceptions = defineQuery<null, Map<string, number>>({
  load: () => import("./haiku/syllableExceptions").then((m) => m.default),
  name: "syllableExceptions",
});

export default function OrpheusIndicator(props: ComposerTrailingProps) {
  const longEnough = createMemo(
    (was = false) => was || props.text.trim().split(WHITESPACE_RE).length >= MIN_WORDS,
  );
  const counts = syllableExceptions.state(() => (longEnough() ? null : undefined));
  const reacts = createMemo(() => {
    const text = props.text.replaceAll("&", "&amp;");
    const exceptions = counts().data;
    return (
      !!exceptions &&
      props.channelId !== HAIKU_OFF_CHANNEL &&
      text.length < MAX_LENGTH &&
      isHaiku(text, exceptions)
    );
  });
  return (
    <Show when={reacts()}>
      <Tooltip class="orpheus-indicator" content="Orpheus will react to this haiku">
        <span tabindex="0">
          <EmojiText text=":woa:" />
        </span>
      </Tooltip>
    </Show>
  );
}
