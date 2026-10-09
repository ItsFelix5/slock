import { EmojiText, Mrkdwn } from "@slock/blockkit";
import { AvatarImage, HoverCard, Icon, type useHoverIntent } from "@slock/ui";
import { createMemo, createSignal, type JSX, Show } from "solid-js";
import { store } from "../../lib/store";
import { AppBadge } from "./AppBadge";
import "./UserHoverCard.css";
import { createLocalTime, createTzDiff, createTzSuffix } from "./userProfileTime";

export default function UserHoverCard(props: {
  userId: string;
  children?: JSX.Element;
  anchor?: () => HTMLElement | undefined;
  hoverIntent?: ReturnType<typeof useHoverIntent>;
}) {
  const [cardOpen, setCardOpen] = createSignal(false);
  const user = createMemo(() => store.users.userById(props.userId));
  const isSelf = createMemo(() => props.userId === store.users.currentUser()?.id);
  const botBio = createMemo(() =>
    cardOpen() && user()?.isBot ? store.users.botBio(user()?.appId, user()?.botId) : undefined,
  );
  const presence = createMemo(() =>
    cardOpen() && !user()?.isBot ? store.users.presenceFor(props.userId) : undefined,
  );

  const openUser = () => (cardOpen() ? user() : undefined);
  const localTime = createLocalTime(openUser, Date.now);
  const tzDiff = createTzDiff(openUser, Date.now);
  const tzSuffix = createTzSuffix(openUser, tzDiff);

  return (
    <HoverCard
      anchor={props.anchor}
      anchorClass="user-hovercard-anchor"
      hoverIntent={props.hoverIntent}
      content={(close) => (
        <Show when={user()}>
          {(u) => (
            <>
              <div class="user-hovercard-top">
                <div
                  class="user-hovercard-avatar flex-center"
                  style={{ background: u().avatarColor }}
                >
                  <AvatarImage avatarUrl={u().avatarUrl} />
                  <Show when={presence()}>
                    {(p) => (
                      <span class="user-hovercard-presence" classList={{ away: p() === "away" }} />
                    )}
                  </Show>
                </div>
                <div class="user-hovercard-heading flex-col">
                  <div class="user-hovercard-name flex-align-center">
                    <span
                      class="user-hovercard-name-label"
                      title={u().originalName && `really ${u().originalName}`}
                    >
                      {u().name}
                    </span>
                    <Show when={u().isBot}>
                      <AppBadge />
                    </Show>
                    <Show when={u().pronouns}>
                      <span class="pronouns truncate">({u().pronouns})</span>
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
                  {tzSuffix()}
                </div>
              </Show>

              <Show when={!isSelf()}>
                <button
                  class="user-hovercard-btn hover-card-action btn-reset flex-center busy"
                  disabled={store.dms.isOpenDmPending(u().id)}
                  onClick={(e) => {
                    close();
                    store.dms.openDmWithUser(u().id, { split: e.shiftKey });
                  }}
                  type="button"
                >
                  <Icon name="direct-messages-filled" size={14} />
                  Message
                </button>
              </Show>
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
