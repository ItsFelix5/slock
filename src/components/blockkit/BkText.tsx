import EmojiText from "../messages/EmojiText";
import Mrkdwn from "./mrkdwn";
import type { TextObject } from "./types";

export default function BkText(props: { text: TextObject | undefined; class?: string }) {
  if (!props.text) return null;
  return (
    <span class={props.class}>
      {props.text.type === "mrkdwn" ? (
        <Mrkdwn text={props.text.text} />
      ) : (
        <EmojiText text={props.text.text} />
      )}
    </span>
  );
}
