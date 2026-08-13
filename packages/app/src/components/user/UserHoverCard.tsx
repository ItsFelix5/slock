import { EmojiText, Mrkdwn } from "@slock/blockkit";
import { HoverCard, Icon } from "@slock/ui";
import { createMemo, createSignal, type JSX, Show } from "solid-js";
import { store } from "../../lib/store";
import AppBadge from "./AppBadge";
import { createLocalTime } from "./userProfileTime";
import ViewProfileButton from "./ViewProfileButton";
import "./UserHoverCard.css";

export default function UserHoverCard(props: { userId: string; children: JSX.Element }) {
  const [cardOpen, setCardOpen] = createSignal(false);
  const user = createMemo(() => store.users.userById(props.userId));
  const isSelf = createMemo(() => props.userId === store.users.currentUser()?.id);
  const botBio = createMemo(() =>
    cardOpen() && user()?.isBot ? store.users.botBio(user()?.appId, user()?.botId) : undefined,
  );

  const localTime = createLocalTime(user, Date.now);

  return (
    <HoverCard
      anchorClass="user-hovercard-anchor"
      content={(close) => (
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
                      <AppBadge />
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
                    class="user-hovercard-btn hover-card-action btn-reset flex-center"
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
      )}
      onOpenChange={setCardOpen}
      openWhen={() => !!user()}
      panelClass="user-hovercard"
      width={300}
    >
      {props.children}
    </HoverCard>
  );
}
