import { EmojiText } from "@slock/blockkit";
import type { Reaction } from "@slock/slack-api";
import { AvatarStack } from "@slock/ui";
import { createMemo, For } from "solid-js";
import { store } from "../../../lib/store";

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
            <button
              class="reaction-pill btn-reset flex-align-center"
              classList={{ mine: mine() }}
              onClick={() => props.onToggle(r.name)}
              type="button"
            >
              <EmojiText text={`:${r.name}:`} />
              <span class="reaction-count">{r.count}</span>
              <AvatarStack
                title={() =>
                  r.users
                    .map((id) =>
                      id === store.users.currentUser()?.id
                        ? "you"
                        : (store.users.userById(id)?.name ?? "someone"),
                    )
                    .reduce(
                      (prev, curr, i, a) =>
                        (prev ? prev + (i < a.length - 1 ? ", " : " and ") : "") + curr,
                      "",
                    )
                }
                users={r.users
                  .slice(0, 3)
                  .map((id) => store.users.userById(id))
                  .filter((u) => u !== undefined)}
              />
            </button>
          );
        }}
      </For>
    </div>
  );
}
