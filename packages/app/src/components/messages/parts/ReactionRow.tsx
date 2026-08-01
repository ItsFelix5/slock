import { EmojiText } from "@slock/blockkit";
import type { Reaction } from "@slock/slack-api";
import { AvatarStack, ContextMenu, Icon, Tooltip, useContextMenu } from "@slock/ui";
import { createMemo, For } from "solid-js";
import { actionFeedback, store } from "../../../lib/store";

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
  feedbackKey?: string;
  isPending?: (name: string) => boolean;
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
          const ctxMenu = useContextMenu();

          const copyReaction = async () => {
            ctxMenu.close();
            try {
              await navigator.clipboard.writeText(`:${r.name}:`);
              if (props.feedbackKey) actionFeedback.flash(props.feedbackKey, "Reaction copied.");
            } catch {
              if (props.feedbackKey)
                actionFeedback.flash(props.feedbackKey, "Couldn’t copy the reaction.", "error");
            }
          };

          return (
            <>
              <Tooltip content={`${reactorNames(r.users)} reacted with :${r.name}:`}>
                <button
                  aria-busy={props.isPending?.(r.name) ?? false}
                  class="reaction-pill btn-reset flex-align-center"
                  classList={{ mine: mine() }}
                  disabled={props.isPending?.(r.name) ?? false}
                  onClick={() => props.onToggle(r.name)}
                  onContextMenu={(e) => ctxMenu.open(e)}
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
              <ContextMenu
                onClose={ctxMenu.close}
                open={ctxMenu.isOpen()}
                x={ctxMenu.x()}
                y={ctxMenu.y()}
              >
                <button class="menu-item" onClick={copyReaction} type="button">
                  <Icon name="copy" size={15} />
                  Copy reaction
                </button>
              </ContextMenu>
            </>
          );
        }}
      </For>
    </div>
  );
}
