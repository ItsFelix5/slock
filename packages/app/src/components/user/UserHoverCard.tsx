import { EmojiText } from "@slock/blockkit";
import { Icon } from "@slock/ui";
import { createMemo, createSignal, type JSX, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { store } from "../../lib/store";
import { createLocalTime } from "./userProfileTime";
import "./UserHoverCard.css";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 160;
const CARD_WIDTH = 300;

// A lightweight preview of a user shown on hover over their name or avatar —
// avatar, presence, status, title and local time — without opening the full
// profile panel. The card is portalled to <body> and fixed-positioned so it is
// never clipped by the surrounding message list's overflow.
export default function UserHoverCard(props: { userId: string; children: JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  const [pos, setPos] = createSignal({ left: 0, top: 0 });
  let anchor: HTMLSpanElement | undefined;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const user = createMemo(() => store.users.userById(props.userId));
  const isSelf = createMemo(() => props.userId === store.users.currentUser()?.id);

  const localTime = createLocalTime(user, Date.now);

  const scheduleOpen = () => {
    clearTimeout(closeTimer);
    openTimer = setTimeout(() => {
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const left = Math.min(r.left, window.innerWidth - CARD_WIDTH - 12);
      setPos({ left: Math.max(12, left), top: r.bottom + 6 });
      setOpen(true);
    }, OPEN_DELAY);
  };
  const scheduleClose = () => {
    clearTimeout(openTimer);
    closeTimer = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  onCleanup(() => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-intent wrapper; the real controls are the buttons inside the children and the card
    <span
      class="user-hovercard-anchor"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      ref={anchor}
    >
      {props.children}
      <Show when={open() && user()}>
        {(u) => (
          <Portal>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-intent container keeping the card open while the pointer is over it */}
            <div
              class="user-hovercard"
              onMouseEnter={() => clearTimeout(closeTimer)}
              onMouseLeave={scheduleClose}
              style={{ left: `${pos().left}px`, top: `${pos().top}px`, width: `${CARD_WIDTH}px` }}
            >
              <div class="user-hovercard-top">
                <div
                  class="user-hovercard-avatar flex-center"
                  style={{ background: u().avatarColor }}
                >
                  <img alt="?" src={u().avatarUrl} />
                  <span
                    class="user-hovercard-presence"
                    classList={{ away: u().presence === "away" }}
                  />
                </div>
                <div class="user-hovercard-heading">
                  <div class="user-hovercard-name">
                    {u().name}
                    <Show when={u().isBot}>
                      <span class="user-hovercard-badge">APP</span>
                    </Show>
                    <Show when={u().pronouns}>
                      <span class="pronouns">({u().pronouns})</span>
                    </Show>
                  </div>
                  <Show when={u().title}>
                    <div class="user-hovercard-title text-muted text-sm">{u().title}</div>
                  </Show>
                </div>
              </div>

              <Show when={u().statusText || u().statusEmoji}>
                <div class="user-hovercard-status flex-align-center text-muted text-sm">
                  <Show when={u().statusEmoji}>{(emoji) => <EmojiText text={emoji()} />}</Show>
                  <span>{u().statusText}</span>
                </div>
              </Show>

              <Show when={localTime()}>
                <div class="user-hovercard-meta flex-align-center text-dim text-sm">
                  <Icon name="clock" size={13} />
                  {localTime()} local time{u().tzLabel ? ` (${u().tzLabel})` : ""}
                </div>
              </Show>

              <div class="user-hovercard-actions">
                <Show
                  fallback={
                    <button
                      class="user-hovercard-btn btn-reset flex-center"
                      onClick={() => {
                        setOpen(false);
                        store.users.openUserProfile(u().id);
                      }}
                      type="button"
                    >
                      View profile
                    </button>
                  }
                  when={!isSelf()}
                >
                  <button
                    class="user-hovercard-btn btn-reset flex-center"
                    onClick={() => {
                      setOpen(false);
                      store.dms.openDmWithUser(u().id);
                    }}
                    type="button"
                  >
                    <Icon name="direct-messages-filled" size={14} />
                    Message
                  </button>
                  <button
                    class="user-hovercard-btn btn-reset flex-center"
                    onClick={() => {
                      setOpen(false);
                      store.users.openUserProfile(u().id);
                    }}
                    type="button"
                  >
                    View profile
                  </button>
                </Show>
              </div>
            </div>
          </Portal>
        )}
      </Show>
    </span>
  );
}
