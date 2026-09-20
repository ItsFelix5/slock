import { Mrkdwn } from "@slock/blockkit";
import { HoverCard, Icon } from "@slock/ui";
import { type JSX, Show } from "solid-js";
import { channelDisplayName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import "./ChannelHoverCard.css";

export default function ChannelHoverCard(props: { channelId: string; children: JSX.Element }) {
  const channel = () => store.channels.channelById(props.channelId);
  const name = () => channelDisplayName(channel(), props.channelId);

  return (
    <HoverCard
      content={() => (
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
