import type { HeaderBlock } from '../types';
import EmojiText from '../../components/messages/EmojiText';

export default function Header(props: { block: HeaderBlock }) {
  return (
    <div class="bk-header">
      <EmojiText text={props.block.text.text} />
    </div>
  );
}
