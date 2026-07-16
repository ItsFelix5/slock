import { EmojiText } from "@slock/blockkit";
import type { Reaction } from "@slock/slack-api";
import { AvatarStack, Tooltip } from "@slock/ui";
import { createMemo, For } from "solid-js";
import { store } from "../../../lib/store";

function reactorNames(users: string[]) {
  return users
    .map((id) =>
      id === store.users.currentUser()?.id ? "you" : (store.users.userById(id)?.name ?? "someone"),
    )
    .reduce(
      (prev, curr, i, a) => (prev ? prev + (i < a.length - 1 ? ", " : " and ") : "") + curr,
      "",
    );
}

export default function ReactionRow(props: {
  reactions: Reaction[];
  onToggle: (name: string) => void;
}) {
  return (
    <div class="reaction-row">
      <For each={props.reactions}>
        {(r) => {
          const mine = createMemo(() => {
            const me = store.users.currentUser();
            return !!me && r.users.includes(me.id);
          });
          return (
            <Tooltip content={`${reactorNames(r.users)} reacted with :${r.name}:`}>
              <button
                class="reaction-pill btn-reset flex-align-center"
                classList={{ mine: mine() }}
                onClick={() => props.onToggle(r.name)}
                type="button"
              >
                <EmojiText text={`:${r.name}:`} />
                <span class="reaction-count">{r.count}</span>
                <AvatarStack
                  users={r.users
                    .slice(0, 3)
                    .map((id) => store.users.userById(id))
                    .filter((u) => u !== undefined)}
                />
              </button>
            </Tooltip>
          );
        }}
      </For>
    </div>
  );
}
