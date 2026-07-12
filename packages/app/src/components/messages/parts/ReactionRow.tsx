import { EmojiText } from "@slock/blockkit";
import type { Reaction } from "@slock/slack-api";
import { AvatarStack } from "@slock/ui";
import { createMemo, For } from "solid-js";
import { currentUser, userById } from "../../../lib/store";

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
              <AvatarStack
                users={r.users
                  .slice(0, 3)
                  .map((id) => userById(id))
                  .filter((u) => u !== undefined)}
                title={() =>
                  r.users
                    .map((id) =>
                      id === currentUser()?.id ? "you" : (userById(id)?.name ?? "someone"),
                    )
                    .reduce(
                      (prev, curr, i, a) =>
                        (prev ? prev + (i < a.length - 1 ? ", " : " and ") : "") + curr,
                      "",
                    )
                }
              />
            </button>
          );
        }}
      </For>
    </div>
  );
}
