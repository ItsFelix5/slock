import { EmojiText } from "@slock/blockkit";
import type { Reaction } from "@slock/slack-api";
import { Avatar } from "@slock/ui";
import { createMemo, For, Show } from "solid-js";
import { currentUser, userById } from "../../lib/store";
import { formatInteractorNames } from "./InteractorAvatars";

const TOOLTIP_AVATAR_LIMIT = 12;

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
          const tooltip = createMemo(() => {
            const who = formatInteractorNames(r.users);
            return who ? `${who} reacted` : "";
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
              <Show when={r.users.length > 0}>
                <span class="reaction-tooltip">
                  <span class="reaction-tooltip-avatars">
                    <For each={r.users.slice(0, TOOLTIP_AVATAR_LIMIT)}>
                      {(id) => {
                        const user = createMemo(() => userById(id));
                        return (
                          <Show when={user()}>{(u) => <Avatar user={u()} size="small" />}</Show>
                        );
                      }}
                    </For>
                  </span>
                  <span class="reaction-tooltip-text">
                    {tooltip()} with <EmojiText text={`:${r.name}:`} />
                  </span>
                </span>
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}
