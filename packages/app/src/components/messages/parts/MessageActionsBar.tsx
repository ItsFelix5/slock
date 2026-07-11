import type { Message } from "@slock/slack-api";
import { Icon, Menu } from "@slock/ui";
import { createMemo, createSignal, Show } from "solid-js";
import {
  isSavedForLater,
  reactToMessage,
  recordEmojiUse,
  toggleSaveForLater,
} from "../../../lib/store";
import EmojiPicker from "../../composer/EmojiPicker";
import MessageActionsMenuItems from "./MessageActionsMenuItems";

export default function MessageActionsBar(props: {
  channelId: string;
  msg: Message;
  threadTs?: string;
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  onEditRequest: () => void;
}) {
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [pickerFlipUp, setPickerFlipUp] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [moreFlipUp, setMoreFlipUp] = createSignal(false);
  let pickerWrapRef: HTMLDivElement | undefined;
  let moreBtnRef: HTMLButtonElement | undefined;

  // The picker's own height (see EmojiPicker.css) plus a little breathing
  // room — if opening downward from here would run past the viewport bottom
  // (e.g. reacting on one of the last messages in the list), flip it to open
  // upward from the button instead so it's never clipped off-screen.
  const PICKER_HEIGHT = 400;
  const MORE_MENU_HEIGHT = 220;

  const togglePicker = () => {
    if (!pickerOpen() && pickerWrapRef) {
      const rect = pickerWrapRef.getBoundingClientRect();
      setPickerFlipUp(rect.bottom + PICKER_HEIGHT > window.innerHeight);
    }
    setPickerOpen(!pickerOpen());
  };

  const toggleMore = () => {
    if (!moreOpen() && moreBtnRef) {
      const rect = moreBtnRef.getBoundingClientRect();
      setMoreFlipUp(rect.bottom + MORE_MENU_HEIGHT > window.innerHeight);
    }
    setMoreOpen(!moreOpen());
  };

  // A broadcasted reply's own ts is just where it landed in the channel —
  // its actual thread lives at threadTs, so "reply in thread" must jump
  // there instead of opening a new thread rooted on the broadcast itself.
  const threadRootTs = createMemo(() =>
    props.msg.isBroadcast && props.msg.threadTs ? props.msg.threadTs : props.msg.ts,
  );

  const isSaved = createMemo(() => isSavedForLater(props.msg.ts));

  const react = (name: string) => {
    recordEmojiUse(name);
    reactToMessage(props.channelId, props.msg, name);
    setPickerOpen(false);
  };

  return (
    <div class="message-hover-actions" classList={{ "force-visible": pickerOpen() || moreOpen() }}>
      <div class="message-hover-picker-wrap" ref={pickerWrapRef}>
        <button type="button" class="message-hover-btn" title="React" onClick={togglePicker}>
          <Icon name="emoji" size={16} />
        </button>
        <Show when={pickerOpen()}>
          <div class="reaction-picker-full" classList={{ "flip-up": pickerFlipUp() }}>
            <EmojiPicker onSelect={react} onClose={() => setPickerOpen(false)} />
          </div>
        </Show>
      </div>

      <Show when={props.onOpenThread}>
        <button
          type="button"
          class="message-hover-btn"
          title="Reply in thread"
          onClick={() => props.onOpenThread?.(threadRootTs())}
        >
          <Icon name="threads" size={16} />
        </button>
      </Show>

      <Show when={props.onReplyLink}>
        <button
          type="button"
          class="message-hover-btn"
          title="Reply"
          onClick={() => props.onReplyLink?.(props.msg)}
        >
          <Icon name="email-reply" size={16} />
        </button>
      </Show>

      <button
        type="button"
        class="message-hover-btn"
        classList={{ active: isSaved() }}
        title={isSaved() ? "Remove from Later" : "Save for later"}
        onClick={() => toggleSaveForLater(props.channelId, props.msg.ts)}
      >
        <Icon name={isSaved() ? "bookmark-filled" : "bookmark"} size={15} />
      </button>

      <Menu
        class="message-hover-picker-wrap"
        panelClass={`menu-panel message-more-menu${moreFlipUp() ? " flip-up" : ""}`}
        open={moreOpen()}
        onClose={() => setMoreOpen(false)}
        trigger={
          <button
            ref={moreBtnRef}
            type="button"
            class="message-hover-btn"
            title="More actions"
            onClick={toggleMore}
          >
            <Icon name="ellipsis-vertical-filled" size={16} />
          </button>
        }
      >
        <MessageActionsMenuItems
          channelId={props.channelId}
          msg={props.msg}
          threadTs={props.threadTs}
          onEditRequest={props.onEditRequest}
          onClose={() => setMoreOpen(false)}
        />
      </Menu>
    </div>
  );
}
