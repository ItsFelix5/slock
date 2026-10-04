import type { useHoverIntent } from "@slock/ui";
import { createMemo, Match, Show, Switch } from "solid-js";
import { parseSlackPermalink } from "../../lib/navigation/slackPermalink";
import { store } from "../../lib/store";
import ChannelHoverCard from "../channel/channel-details/ChannelHoverCard";
import MessageLinkHoverCard, {
  messageToHoverPreview,
} from "../messages/parts/MessageLinkHoverCard";
import UserHoverCard from "../user/UserHoverCard";
import UsergroupHoverCard from "../usergroup/UsergroupHoverCard";
import type { MentionHoverState } from "./lib/mentionHover";

export default function MentionHoverCard(props: {
  state: () => MentionHoverState | undefined;
  hoverIntent: ReturnType<typeof useHoverIntent>;
}) {
  const anchor = () => props.state()?.anchorEl;
  const permalink = createMemo(() => {
    const s = props.state();
    return s?.kind === "messagelink" ? parseSlackPermalink(s.id) : undefined;
  });
  const knownPreview = createMemo(() => {
    const target = permalink();
    if (!target) return;
    const msg = store.messages
      .findAllMessageLocations(target.channelId, target.messageTs)[0]
      ?.list.find((m) => m.ts === target.messageTs);
    return msg ? messageToHoverPreview(msg) : undefined;
  });

  return (
    <Show when={props.state()}>
      {(state) => (
        <Switch>
          <Match when={state().kind === "user" || state().kind === "userlink"}>
            <UserHoverCard anchor={anchor} hoverIntent={props.hoverIntent} userId={state().id} />
          </Match>
          <Match when={state().kind === "channel"}>
            <ChannelHoverCard
              anchor={anchor}
              channelId={state().id}
              hoverIntent={props.hoverIntent}
            />
          </Match>
          <Match when={state().kind === "usergroup"}>
            <UsergroupHoverCard
              anchor={anchor}
              hoverIntent={props.hoverIntent}
              usergroupId={state().id}
            />
          </Match>
          <Match when={permalink()}>
            {(target) => (
              <MessageLinkHoverCard
                anchor={anchor}
                channelId={target().channelId}
                hoverIntent={props.hoverIntent}
                knownPreview={knownPreview()}
                messageTs={target().messageTs}
                threadTs={target().threadTs}
              />
            )}
          </Match>
        </Switch>
      )}
    </Show>
  );
}
