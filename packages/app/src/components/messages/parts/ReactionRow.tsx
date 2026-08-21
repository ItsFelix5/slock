import { EmojiText } from "@slock/blockkit";
import {
  AvatarStack,
  ContextMenu,
  MenuItem,
  openContextMenuFromKeyboard,
  Tooltip,
  useContextMenu,
} from "@slock/ui";
import { createMemo, For } from "solid-js";
import type { Reaction } from "../../../lib/api";
import { actionFeedback } from "../../../lib/feedback";
import { formatInteractorNames } from "../../../lib/interactorNames";
import { store } from "../../../lib/store";

function reactorNames(users: string[]) {
  return formatInteractorNames(users, store.users.currentUser()?.id, store.users.userById);
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

          const copyReactors = async () => {
            ctxMenu.close();
            try {
              await navigator.clipboard.writeText(r.users.map((id) => `<@${id}>`).join(" "));
            } catch {
              if (props.feedbackKey)
                actionFeedback.flash(props.feedbackKey, "Couldn't copy the reactors.", "error");
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
                  onKeyDown={(e) => openContextMenuFromKeyboard(e, ctxMenu.openAt)}
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
                <MenuItem icon="user-groups" onClick={copyReactors}>
                  Copy reactors
                </MenuItem>
              </ContextMenu>
            </>
          );
        }}
      </For>
    </div>
  );
}
