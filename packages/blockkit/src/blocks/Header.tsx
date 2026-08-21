import type { HeaderBlock } from "@slock/types";
import EmojiText from "../emoji/EmojiText";

export default function Header(props: { block: HeaderBlock }) {
  return (
    <div class={`bk-header bk-header-${props.block.level ?? 1}`}>
      <EmojiText text={props.block.text.text} />
    </div>
  );
}
