import EmojiText from "../../messages/EmojiText";
import type { HeaderBlock } from "../types";

export default function Header(props: { block: HeaderBlock }) {
  return (
    <div class="bk-header">
      <EmojiText text={props.block.text.text} />
    </div>
  );
}
