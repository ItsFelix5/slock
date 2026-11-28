import { EmojiText } from "@slock/blockkit";
import { lazyChunk, service } from "@slock/core/solid";
import { formatInteractorNames } from "@slock/plugins/users/client/api";
import type { Reaction, UserId } from "@slock/types";
import {
  AvatarStack,
  ContextMenu,
  DEFAULT_AVATAR_COLOR,
  Icon,
  MenuItem,
  Tooltip,
  useContextMenu,
} from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import "./ReactionRow.css";

const feedback = service("feedback");

const usersStore = service("users");

const FloatingEmojiPicker = lazyChunk(
  () => import("@slock/plugins/emoji/client/api/FloatingEmojiPicker"),
);

function reactorNames(users: UserId[]) {
  return formatInteractorNames(users, usersStore.currentUserId(), usersStore.userById);
}

export default function ReactionRow(props: {
  feedbackKey?: string;
  reactions: Reaction[];
  onToggle: (name: string) => void;
  allowAdd?: boolean;
  readOnly?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = createSignal(false);
  let addButtonRef: HTMLButtonElement | undefined;

  const existingReactions = createMemo(() => {
    const me = usersStore.currentUserId();
    return props.reactions.map((r) => ({
      mine: !!me && r.users.includes(me),
      name: r.name,
    }));
  });

  return (
    <div class="reaction-row">
      <For each={props.reactions} keyed={(reaction) => reaction.name}>
        {(r) => {
          const mine = createMemo(() => {
            const me = usersStore.currentUser();
            return !!me && r().users.includes(me.id);
          });
          const ctxMenu = useContextMenu();

          const copyReactors = async () => {
            ctxMenu.close();
            try {
              await navigator.clipboard.writeText(
                r()
                  .users.map((id) => `<@${id}>`)
                  .join(" "),
              );
            } catch {
              if (props.feedbackKey)
                feedback.flash(props.feedbackKey, "Couldn't copy the reactors.", "error");
            }
          };

          return (
            <>
              <Tooltip content={`${reactorNames(r().users)} reacted with :${r().name}:`}>
                <button
                  class={["reaction-pill btn-reset flex-align-center", { mine: mine() }]}
                  disabled={props.readOnly}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggle(r().name);
                  }}
                  onContextMenu={(e) => ctxMenu.open(e)}
                  type="button"
                >
                  <EmojiText text={`:${r().name}:`} />
                  <span class="reaction-count">{r().count}</span>
                  <AvatarStack
                    users={r()
                      .users.slice(0, 3)
                      .map(
                        (id) =>
                          usersStore.userById(id) ?? {
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
        <button
          aria-label="Add a reaction"
          class="reaction-pill btn-reset flex-center"
          onClick={() => setPickerOpen(!pickerOpen())}
          ref={addButtonRef}
          type="button"
        >
          <Icon name="add-reaction" size={16} />
        </button>
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
