import type { HeaderBlock } from "@slock/slack-api";
import EmojiText from "../EmojiText";

export default function Header(props: { block: HeaderBlock }) {
  return (
    <div class="bk-header">
      <EmojiText text={props.block.text.text} />
    </div>
  );
}
