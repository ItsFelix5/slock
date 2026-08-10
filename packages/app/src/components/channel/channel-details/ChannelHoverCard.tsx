import { Mrkdwn } from "@slock/blockkit";
import { HoverCard, Icon } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { channelDisplayName, store } from "../../../lib/store";
import "./ChannelHoverCard.css";

export default function ChannelHoverCard(props: { channelId: string; children: JSX.Element }) {
  const channel = createMemo(() => store.channels.channelById(props.channelId));
  const isMember = createMemo(() => store.channels.isChannelMember(props.channelId));
  const name = () => channelDisplayName(channel(), props.channelId);

  return (
    <HoverCard
      content={(close) => (
        <Show when={channel()}>
          {(c) => (
            <>
              <div class="channel-hovercard-heading flex-align-center">
                <Show fallback={<span class="channel-hovercard-hash">#</span>} when={c().private}>
                  <Icon name="lock" size={13} />
                </Show>
                <span class="channel-hovercard-name">{name()}</span>
              </div>

              <Show when={c().topic}>
                <div class="channel-hovercard-topic text-muted text-sm truncate-lines">
                  <Mrkdwn text={c().topic ?? ""} />
                </div>
              </Show>

              <Show when={c().memberCount}>
                {(count) => (
                  <div class="channel-hovercard-members flex-align-center text-muted text-sm">
                    <Icon name="user-groups" size={13} />
                    {count()} {count() === 1 ? "member" : "members"}
                  </div>
                )}
              </Show>

              <Show
                fallback={
                  <button
                    class="hover-card-action btn-reset flex-center"
                    onClick={() => {
                      close();
                      store.viewState.setActiveView({ id: props.channelId, kind: "channel" });
                    }}
                    type="button"
                  >
                    <Icon name="arrow-right-channel" size={14} />
                    Open channel
                  </button>
                }
                when={!isMember()}
              >
                <button
                  class="hover-card-action btn-reset flex-center"
                  onClick={() => {
                    close();
                    store.channels.joinChannelById(props.channelId);
                  }}
                  type="button"
                >
                  <Icon name="plus" size={14} />
                  Join channel
                </button>
              </Show>
            </>
          )}
        </Show>
      )}
      onOpenChange={(open) => {
        if (open) store.channels.ensureChannelTopic(props.channelId);
      }}
      openWhen={() => !!channel()}
      panelClass="channel-hovercard"
      width={280}
    >
      {props.children}
    </HoverCard>
  );
}
