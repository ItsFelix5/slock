import { service } from "@slock/core/solid";
import { createMemo, Show } from "solid-js";
import type { MentionCardProps } from "../../../../composer/client/api";
import { parseSlackPermalink } from "../../../../message-links/client/api/slackPermalink";
import MessageLinkHoverCard, { messageToHoverPreview } from "./MessageLinkHoverCard";

const messagesStore = service("messages");

export default function MessageLinkMentionCard(props: MentionCardProps) {
  const target = createMemo(() =>
    props.kind === "messagelink" ? parseSlackPermalink(props.id) : undefined,
  );
  const knownPreview = (channelId: string, messageTs: string) => {
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
