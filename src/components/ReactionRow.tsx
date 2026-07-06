import { For, createMemo } from 'solid-js';
import { currentUser } from '../store';
import type { Reaction } from '../types';
import EmojiText from './EmojiText';

export default function ReactionRow(props: { reactions: Reaction[]; onToggle: (name: string) => void }) {
  return (
    <div class="reaction-row">
      <For each={props.reactions}>
        {(r) => {
          const mine = createMemo(() => {
            const me = currentUser();
            return !!me && r.users.includes(me.id);
          });
          return (
            <button class="reaction-pill" classList={{ mine: mine() }} onClick={() => props.onToggle(r.name)}>
              <EmojiText text={`:${r.name}:`} />
              <span class="reaction-count">{r.count}</span>
            </button>
          );
        }}
      </For>
    </div>
  );
}
