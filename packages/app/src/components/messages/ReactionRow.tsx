import { EmojiText } from "@slock/blockkit";
import type { Reaction } from "@slock/slack-api";
import { createMemo, For } from "solid-js";
import { currentUser } from "../../lib/store";

export default function ReactionRow(props: {
  reactions: Reaction[];
  onToggle: (name: string) => void;
}) {
  return (
    <div class="reaction-row">
      <For each={props.reactions}>
        {(r) => {
          const mine = createMemo(() => {
            const me = currentUser();
            return !!me && r.users.includes(me.id);
          });
          return (
            <button
              type="button"
              class="reaction-pill"
              classList={{ mine: mine() }}
              onClick={() => props.onToggle(r.name)}
            >
              <EmojiText text={`:${r.name}:`} />
              <span class="reaction-count">{r.count}</span>
            </button>
          );
        }}
      </For>
    </div>
  );
}
