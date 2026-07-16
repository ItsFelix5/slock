import type { Message } from "@slock/slack-api";
import { Icon, Menu } from "@slock/ui";
import { createMemo, createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { store } from "../../../lib/store";
import EmojiPicker from "../../composer/popovers/EmojiPicker";
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
  const [pickerPos, setPickerPos] = createSignal({ left: 0, top: 0 });
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [moreFlipUp, setMoreFlipUp] = createSignal(false);
  let pickerWrapRef: HTMLDivElement | undefined;
  let moreBtnRef: HTMLButtonElement | undefined;

  // The picker's own size (see EmojiPicker.css) plus a little breathing room.
  // It's portalled to <body> and fixed-positioned (like UserHoverCard) rather
  // than absolutely positioned inside the message row, because message lists
  // (and especially the narrow thread panel) scroll with overflow: auto,
  // which clips any in-flow popup that would otherwise spill outside them.
  const PickerWidth = 320;
  const PickerHeight = 400;
  const MoreMenuHeight = 220;

  const togglePicker = () => {
    if (!pickerOpen() && pickerWrapRef) {
      const rect = pickerWrapRef.getBoundingClientRect();
      const flipUp = rect.bottom + PickerHeight > window.innerHeight;
      const left = Math.min(rect.right - PickerWidth, window.innerWidth - PickerWidth - 8);
      setPickerPos({
        left: Math.max(8, left),
        top: flipUp ? rect.top - PickerHeight : rect.bottom + 4,
      });
    }
    setPickerOpen(!pickerOpen());
  };

  const toggleMore = () => {
    if (!moreOpen() && moreBtnRef) {
      const rect = moreBtnRef.getBoundingClientRect();
      setMoreFlipUp(rect.bottom + MoreMenuHeight > window.innerHeight);
    }
    setMoreOpen(!moreOpen());
  };

  // A broadcasted reply's own ts is just where it landed in the channel —
  // its actual thread lives at threadTs, so "reply in thread" must jump
  // there instead of opening a new thread rooted on the broadcast itself.
  const threadRootTs = createMemo(() =>
    props.msg.isBroadcast && props.msg.threadTs ? props.msg.threadTs : props.msg.ts,
  );

  const isSaved = createMemo(() => store.later.isSavedForLater(props.msg.ts));

  const react = (name: string) => {
    store.messages.reactToMessage(props.channelId, props.msg, name);
    setPickerOpen(false);
  };

  return (
    <div class="message-hover-actions" classList={{ "force-visible": pickerOpen() || moreOpen() }}>
      <div class="message-hover-picker-wrap" ref={pickerWrapRef}>
        <button
          class="message-hover-btn btn-reset flex-center"
          onClick={togglePicker}
          title="React"
          type="button"
        >
          <Icon name="emoji" size={16} />
        </button>
        <Show when={pickerOpen()}>
          <Portal>
            <div
              class="reaction-picker-full"
              style={{ left: `${pickerPos().left}px`, top: `${pickerPos().top}px` }}
            >
              <EmojiPicker onClose={() => setPickerOpen(false)} onSelect={react} />
            </div>
          </Portal>
        </Show>
      </div>

      <Show when={props.onOpenThread}>
        <button
          class="message-hover-btn btn-reset flex-center"
          onClick={() => props.onOpenThread?.(threadRootTs())}
          title="Reply in thread"
          type="button"
        >
          <Icon name="threads" size={16} />
        </button>
      </Show>

      <Show when={props.onReplyLink}>
        <button
          class="message-hover-btn btn-reset flex-center"
          onClick={() => props.onReplyLink?.(props.msg)}
          title="Reply"
          type="button"
        >
          <Icon name="email-reply" size={16} />
        </button>
      </Show>

      <button
        class="message-hover-btn btn-reset flex-center"
        classList={{ active: isSaved() }}
        onClick={() => store.later.toggleSaveForLater(props.channelId, props.msg.ts)}
        title={isSaved() ? "Remove from Later" : "Save for later"}
        type="button"
      >
        <Icon name={isSaved() ? "bookmark-filled" : "bookmark"} size={15} />
      </button>

      <Menu
        class="message-hover-picker-wrap"
        onClose={() => setMoreOpen(false)}
        open={moreOpen()}
        panelClass={`menu-panel message-more-menu${moreFlipUp() ? " flip-up" : ""}`}
        trigger={
          <button
            class="message-hover-btn btn-reset flex-center"
            onClick={toggleMore}
            ref={moreBtnRef}
            title="More actions"
            type="button"
          >
            <Icon name="ellipsis-vertical-filled" size={16} />
          </button>
        }
      >
        <MessageActionsMenuItems
          channelId={props.channelId}
          msg={props.msg}
          onClose={() => setMoreOpen(false)}
          onEditRequest={props.onEditRequest}
          threadTs={props.threadTs}
        />
      </Menu>
    </div>
  );
}
