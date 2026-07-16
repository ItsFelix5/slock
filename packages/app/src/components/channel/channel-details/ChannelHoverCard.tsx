import { FloatingPanel, Icon, useHoverIntent } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { channelDisplayName, store } from "../../../lib/store";
import "./ChannelHoverCard.css";

const CARD_WIDTH = 280;

// A lightweight preview of a channel shown on hover over a #mention — name,
// topic and a join/open action — without leaving the message list.
export default function ChannelHoverCard(props: { channelId: string; children: JSX.Element }) {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let anchorRef: HTMLSpanElement | undefined;
  const { cancelClose, close, open, scheduleClose, scheduleOpen } = useHoverIntent();

  const channel = createMemo(() => store.channels.channelById(props.channelId));
  const isMember = createMemo(() => store.channels.isChannelMember(props.channelId));
  const name = () => channelDisplayName(channel(), props.channelId);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-intent wrapper; the real controls are the mention button and the card's own buttons
    <span
      class="channel-hovercard-anchor"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      ref={anchorRef}
    >
      {props.children}
      <FloatingPanel
        align="start"
        anchor={() => anchorRef}
        class="channel-hovercard"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        open={open() && !!channel()}
        placement="top"
        style={{ width: `${CARD_WIDTH}px` }}
      >
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
                  {c().topic}
                </div>
              </Show>

              <Show
                fallback={
                  <button
                    class="channel-hovercard-btn btn-reset flex-center"
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
                  class="channel-hovercard-btn btn-reset flex-center"
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
      </FloatingPanel>
    </span>
  );
}
