import type { TextObject } from "@slock/types";
import { Show } from "solid-js";
import EmojiText from "./emoji/EmojiText";
import Mrkdwn from "./mrkdwn/mrkdwn";

export default function BkText(props: { text: TextObject | undefined; class?: string }) {
  return (
    <Show when={props.text}>
      {(text) => (
        <span class={props.class}>
          {text().type === "mrkdwn" ? (
            <Mrkdwn text={text().text} />
          ) : (
            <EmojiText text={text().text} />
          )}
        </span>
      )}
    </Show>
  );
}
