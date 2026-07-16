import { EmojiText } from "@slock/blockkit";
import { FloatingPanel, Icon, useHoverIntent } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { store } from "../../lib/store";
import { createLocalTime } from "./userProfileTime";
import "./UserHoverCard.css";

const CARD_WIDTH = 300;

// A lightweight preview of a user shown on hover over their name or avatar —
// avatar, presence, status, title and local time — without opening the full
// profile panel. Positioned via FloatingPanel (Portal + viewport flip/clamp) so it
// is never clipped by the surrounding message list's overflow.
export default function UserHoverCard(props: { userId: string; children: JSX.Element }) {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let anchorRef: HTMLSpanElement | undefined;
  const { cancelClose, close, open, scheduleClose, scheduleOpen } = useHoverIntent();

  const user = createMemo(() => store.users.userById(props.userId));
  const isSelf = createMemo(() => props.userId === store.users.currentUser()?.id);

  const localTime = createLocalTime(user, Date.now);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-intent wrapper; the real controls are the buttons inside the children and the card
    <span
      class="user-hovercard-anchor"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      ref={anchorRef}
    >
      {props.children}
      <FloatingPanel
        align="start"
        anchor={() => anchorRef}
        class="user-hovercard"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        open={open() && !!user()}
        placement="top"
        style={{ width: `${CARD_WIDTH}px` }}
      >
        <Show when={user()}>
          {(u) => (
            <>
              <div class="user-hovercard-top">
                <div
                  class="user-hovercard-avatar flex-center"
                  style={{ background: u().avatarColor }}
                >
                  <span aria-hidden="true">?</span>
                  <img
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    src={u().avatarUrl}
                  />
                  <span
                    class="user-hovercard-presence"
                    classList={{ away: u().presence === "away" }}
                  />
                </div>
                <div class="user-hovercard-heading">
                  <div class="user-hovercard-name">
                    <span class="user-hovercard-name-label">{u().name}</span>
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
                  {localTime()} local time
                  {u().tzLabel ? ` (${u().tzLabel})` : ""}
                </div>
              </Show>

              <div class="user-hovercard-actions">
                <Show
                  fallback={
                    <button
                      class="user-hovercard-btn btn-reset flex-center"
                      onClick={() => {
                        close();
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
                      close();
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
                      close();
                      store.users.openUserProfile(u().id);
                    }}
                    type="button"
                  >
                    View profile
                  </button>
                </Show>
              </div>
            </>
          )}
        </Show>
      </FloatingPanel>
    </span>
  );
}
