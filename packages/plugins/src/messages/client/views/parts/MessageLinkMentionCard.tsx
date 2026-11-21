import { service } from "@slock/core/solid";
import type { MentionCardProps } from "@slock/plugins/composer/client/api";
import { parseSlackPermalink } from "@slock/plugins/message-links/client/api/slackPermalink";
import type { ChannelId, Ts } from "@slock/types";
import { createMemo, Show } from "solid-js";
import MessageLinkHoverCard, { messageToHoverPreview } from "./MessageLinkHoverCard";

const messagesStore = service("messages");

export default function MessageLinkMentionCard(props: MentionCardProps) {
  const target = createMemo(() =>
    props.kind === "messagelink" ? parseSlackPermalink(props.id) : undefined,
  );
  const knownPreview = (channelId: ChannelId, messageTs: Ts) => {
    const msg = messagesStore
      .findAllMessageLocations(channelId, messageTs)[0]
      ?.list.find((m) => m.ts === messageTs);
    return msg ? messageToHoverPreview(msg) : undefined;
  };
  return (
    <Show when={target()}>
      {(link) => (
        <MessageLinkHoverCard
          anchor={props.anchor}
          channelId={link().channelId}
          hoverIntent={props.hoverIntent}
          knownPreview={knownPreview(link().channelId, link().messageTs)}
          messageTs={link().messageTs}
          threadTs={link().threadTs}
        />
      )}
    </Show>
  );
}
