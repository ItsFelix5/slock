import { service } from "@slock/core/solid";
import { IconButton } from "@slock/ui";
import { lazy, Show } from "solid-js";
import type { MessageBarProps } from "../../../messages/client/api";

const FloatingEmojiPicker = lazy(() => import("../../../emoji/client/api/FloatingEmojiPicker"));

export default function ReactButton(props: MessageBarProps) {
  const users = service("users");
  const messages = service("messages");
  let pickerWrapRef: HTMLDivElement | undefined;
  const open = () => props.reactionPickerTs() === props.msg.ts;
  const toggle = () => props.onToggleReactionPicker(props.msg.ts);
  const existing = () => {
    const me = users.currentUser()?.id;
    return (props.msg.reactions ?? []).map((r) => ({
      mine: !!me && r.users.includes(me),
      name: r.name,
    }));
  };
  return (
    <div class="message-hover-picker-wrap" ref={pickerWrapRef}>
      <IconButton
        class="message-hover-btn icon-shift busy hover-hl"
        icon="emoji"
        label="React"
        onClick={toggle}
        tabIndex={props.rowFocused() ? undefined : -1}
      />
      <Show when={open()}>
        <FloatingEmojiPicker
          anchor={() => pickerWrapRef}
          existingReactions={existing()}
          onClose={toggle}
          onSelect={(name) => {
            messages.reactToMessage(props.channelId, props.msg, name);
            toggle();
          }}
          open
        />
      </Show>
    </div>
  );
}
