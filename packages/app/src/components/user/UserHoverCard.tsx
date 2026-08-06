import { EmojiText, Mrkdwn } from "@slock/blockkit";
import { FloatingPanel, Icon, useHoverIntent } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { store } from "../../lib/store";
import { createLocalTime } from "./userProfileTime";
import ViewProfileButton from "./ViewProfileButton";
import "./UserHoverCard.css";

const CARD_WIDTH = 300;

// A lightweight preview of a user shown on hover over their name or avatar —
// avatar, presence, status, title and local time — without opening the full
// profile panel. Positioned via FloatingPanel (Portal + viewport flip/clamp) so it
// is never clipped by the surrounding message list's overflow.
export default function UserHoverCard(props: { userId: string; children: JSX.Element }) {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let anchorRef: HTMLSpanElement | undefined;
  const { cancelClose, close, open, openNow, scheduleClose, scheduleOpen } = useHoverIntent();

  const user = createMemo(() => store.users.userById(props.userId));
  const isSelf = createMemo(() => props.userId === store.users.currentUser()?.id);
  const botBio = createMemo(() =>
    open() && user()?.isBot ? store.users.botBio(user()?.appId, user()?.botId) : undefined,
  );

  const localTime = createLocalTime(user, Date.now);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-intent wrapper; the real controls are the buttons inside the children and the card
    <span
      class="user-hovercard-anchor"
      onFocusIn={openNow}
      onFocusOut={(e) => {
        if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)))
          close();
      }}
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
        onScroll={close}
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
                  <Show when={u().presence}>
                    <span
                      class="user-hovercard-presence"
                      classList={{ away: u().presence === "away" }}
                    />
                  </Show>
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
                  <Show when={u().title || botBio()}>
                    <div class="user-hovercard-title text-muted text-sm">
                      <Show fallback={<Mrkdwn text={botBio() ?? ""} />} when={u().title}>
                        {u().title}
                      </Show>
                    </div>
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
                    <ViewProfileButton
                      onClose={close}
                      onViewProfile={() => store.users.openUserProfile(u().id)}
                    />
                  }
                  when={!isSelf()}
                >
                  <button
                    class="user-hovercard-btn btn-reset flex-center"
                    disabled={store.dms.isOpenDmPending(u().id)}
                    onClick={() => {
                      close();
                      store.dms.openDmWithUser(u().id);
                    }}
                    type="button"
                  >
                    <Icon name="direct-messages-filled" size={14} />
                    Message
                  </button>
                  <ViewProfileButton
                    onClose={close}
                    onViewProfile={() => store.users.openUserProfile(u().id)}
                  />
                </Show>
              </div>
            </>
          )}
        </Show>
      </FloatingPanel>
    </span>
  );
}
