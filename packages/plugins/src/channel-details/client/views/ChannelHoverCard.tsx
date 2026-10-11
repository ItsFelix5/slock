import { Mrkdwn } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { HoverCard, Icon, Skeleton, type useHoverIntent } from "@slock/ui";
import { type JSX, Show } from "solid-js";
import { channelDisplayName } from "../../../channels/client/api";
import "./ChannelHoverCard.css";

const channelsStore = service("channels");

export default function ChannelHoverCard(props: {
  channelId: string;
  children?: JSX.Element;
  anchor?: () => HTMLElement | undefined;
  hoverIntent?: ReturnType<typeof useHoverIntent>;
}) {
  const channel = () => channelsStore.channelById(props.channelId);
  const name = () => channelDisplayName(channel(), props.channelId);

  return (
    <HoverCard
      anchor={props.anchor}
      hoverIntent={props.hoverIntent}
      content={() => (
        <Show when={channel()}>
          {(c) => (
            <>
              <div class="channel-hovercard-heading flex-align-center">
                <Show fallback={<span class="channel-hovercard-hash">#</span>} when={c().private}>
                  <Icon name="lock" size={13} />
                </Show>
                <span class="channel-hovercard-name truncate">{name()}</span>
              </div>

              <Show when={c().topic}>
                <div class="channel-hovercard-topic text-muted text-sm truncate-lines">
                  <Mrkdwn text={c().topic ?? ""} />
                </div>
              </Show>

              <Show
                when={
                  c().memberCount !== undefined || channelsStore.isChannelMember(props.channelId)
                }
              >
                <div class="channel-hovercard-members flex-align-center text-muted text-sm">
                  <Icon name="user-groups" size={13} />
                  <Show fallback={<Skeleton width={70} />} when={c().memberCount}>
                    {(count) => (
                      <span>
                        {count()} {count() === 1 ? "member" : "members"}
                      </span>
                    )}
                  </Show>
                </div>
              </Show>
            </>
          )}
        </Show>
      )}
      onOpenChange={(open) => {
        if (open) channelsStore.ensureChannelTopic(props.channelId);
      }}
      openWhen={() => !!channel()}
      panelClass="channel-hovercard"
      width={280}
    >
      {props.children}
    </HoverCard>
  );
}
