import { EmojiText } from "@slock/blockkit";
import { formatDayFromMs, formatTimeFromMs } from "@slock/core";
import type { ActivityItem } from "@slock/types";
import { ClickableInline, Icon, Tooltip } from "@slock/ui";
import { Show } from "solid-js";
import { openConversation, openConversationInSplit } from "../../../conversations/client/api/nav";
import { resolveProfileUserId } from "../../../messages/client/api/messageAuthor";
import { ClickableAuthorName } from "../../../profile/client/api/AppBadge";
import { SplitNavigation } from "../../../shell/client/api/SplitNavigation";
import { activityVerb } from "./activityMetadata";
import type { ActivityRowDisplay } from "./activityRowDisplay";
import { ACTIVITY_KIND_ICONS } from "./activityViewFilters";

export default function ActivityHeadline(props: {
  count: number;
  display: ActivityRowDisplay;
  isReactionGroup: boolean;
  isThreadGroup: boolean;
  latest: ActivityItem;
}) {
  const profileUserId = () => resolveProfileUserId(props.latest);
  return (
    <span class="activity-headline truncate">
      <Tooltip content={activityVerb(props.latest)}>
        <Show
          fallback={
            <Icon
              class="activity-kind-icon"
              name={ACTIVITY_KIND_ICONS[props.latest.kind]}
              size={12}
            />
          }
          when={
            props.latest.kind === "reaction" && props.display.reactions().length <= 1
              ? props.latest.reactionName
              : undefined
          }
        >
          {(name) => (
            <span class="activity-kind-icon activity-reaction-emoji">
              <EmojiText text={`:${name()}:`} />
            </span>
          )}
        </Show>
      </Tooltip>
      <Show when={props.isReactionGroup}>
        <strong>{props.display.interactorNames(props.display.replierIds(), 2)}</strong>
      </Show>
      <Show
        when={
          !(props.isThreadGroup || props.isReactionGroup || props.display.isStandaloneActivity())
        }
      >
        <Show fallback={<strong>{props.display.displayName()}</strong>} when={profileUserId()}>
          {(id) => (
            <ClickableAuthorName userId={id()}>
              <strong>{props.display.displayName()}</strong>
            </ClickableAuthorName>
          )}
        </Show>
      </Show>
      <Show when={props.display.showsActivityVerb()}>
        <span class="activity-channel">{activityVerb(props.latest)}</span>
      </Show>
      <Show when={props.latest.kind !== "dm" && !props.display.isStandaloneActivity()}>
        <span class="activity-channel">
          <SplitNavigation onSplit={() => openConversationInSplit(props.latest.channelId)}>
            <ClickableInline onActivate={() => openConversation(props.latest.channelId)}>
              {props.display.channelLabel()}
            </ClickableInline>
          </SplitNavigation>
        </span>
      </Show>
      <Show when={props.count > 1}>
        <span class="activity-reply-count">{props.count}</span>
      </Show>
      <Show when={props.display.isArchived()}>
        <span class="activity-archived-label">
          <Icon name="check" size={11} /> Complete
        </span>
      </Show>
      <Tooltip
        content={`${formatDayFromMs(props.latest.time)} at ${formatTimeFromMs(props.latest.time)}`}
      >
        <span class="activity-time">{formatTimeFromMs(props.latest.time)}</span>
      </Tooltip>
    </span>
  );
}
