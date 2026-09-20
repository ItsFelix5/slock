import { EmojiText } from "@slock/blockkit";
import {
  AvatarStack,
  ContextMenu,
  DEFAULT_AVATAR_COLOR,
  Icon,
  MenuItem,
  openContextMenuFromKeyboard,
  Tooltip,
  useContextMenu,
} from "@slock/ui";
import { createMemo, createSignal, For, lazy, Show } from "solid-js";
import type { Reaction } from "../../../lib/api";
import { formatInteractorNames } from "../../../lib/displayName";
import { actionFeedback } from "../../../lib/feedback";
import { store } from "../../../lib/store";

const FloatingEmojiPicker = lazy(() => import("./FloatingEmojiPicker"));

function reactorNames(users: string[]) {
  return formatInteractorNames(users, store.users.currentUser()?.id, store.users.userById);
}

export default function ReactionRow(props: {
  feedbackKey?: string;
  isPending?: (name: string) => boolean;
  reactions: Reaction[];
  onToggle: (name: string) => void;
  allowAdd?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = createSignal(false);
  let addButtonRef: HTMLButtonElement | undefined;

  const existingReactions = createMemo(() => {
    const me = store.users.currentUser()?.id;
    return props.reactions.map((r) => ({
      mine: !!me && r.users.includes(me),
      name: r.name,
    }));
  });

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
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggle(r.name);
                  }}
                  onContextMenu={(e) => ctxMenu.open(e)}
                  onKeyDown={(e) => openContextMenuFromKeyboard(e, ctxMenu.openAt)}
                  type="button"
                >
                  <EmojiText text={`:${r.name}:`} />
                  <span class="reaction-count">{r.count}</span>
                  <AvatarStack
                    users={r.users.slice(0, 3).map(
                      (id) =>
                        store.users.userById(id) ?? {
                          avatarColor: DEFAULT_AVATAR_COLOR,
                          id,
                          name: "",
                        },
                    )}
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
      <Show when={props.allowAdd}>
        <Tooltip content="Add a reaction">
          <button
            aria-label="Add a reaction"
            class="reaction-pill btn-reset flex-center"
            onClick={() => setPickerOpen(!pickerOpen())}
            ref={addButtonRef}
            type="button"
          >
            <Icon name="add-reaction" size={16} />
          </button>
        </Tooltip>
        <Show when={pickerOpen()}>
          <FloatingEmojiPicker
            anchor={() => addButtonRef}
            existingReactions={existingReactions()}
            onClose={() => setPickerOpen(false)}
            onSelect={(name) => {
              props.onToggle(name);
              setPickerOpen(false);
            }}
            open
          />
        </Show>
      </Show>
    </div>
  );
}
