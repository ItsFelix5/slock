import type { ActivityItem } from "@slock/slack-api";
import { createMemo } from "solid-js";
import {
  conversationDisplayName,
  formatInteractorNames,
  isPingingActivity,
  store,
} from "../../../lib/store";
import {
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  unresolvedAuthorFallback,
} from "../../messages/parts/messageRenderState";

/** The identity/display half of an activity row: who to show, what channel label, and the
 * reacted/pinging/unread flags the row styles itself with - kept apart from the thread-timeline
 * and navigation concerns. */
export function createActivityRowDisplay(deps: {
  items: () => ActivityItem[];
  latest: () => ActivityItem;
}) {
  const user = createMemo(() => store.users.userById(deps.latest().userId));
  const displayName = createMemo(() =>
    resolveAuthorDisplayName(deps.latest(), user()?.name, unresolvedAuthorFallback(deps.latest())),
  );
  const avatarUrl = createMemo(() => resolveAuthorAvatarUrl(deps.latest(), user()?.avatarUrl));
  const channel = createMemo(() => store.channels.channelById(deps.latest().channelId));
  const channelLabel = createMemo(() => {
    if (!deps.latest().channelId) return "Activity";
    return conversationDisplayName(
      deps.latest().channelId,
      channel(),
      store.dms.dmById(deps.latest().channelId),
      store.users.userById,
    );
  });
  const isUnread = createMemo(() => store.activity.isActivityItemUnread(deps.latest()));
  const isReacted = createMemo(() => store.activity.isActivityItemReacted(deps.latest()));
  const isPinging = createMemo(() => isPingingActivity(deps.latest()));
  const isStandaloneActivity = createMemo(() => !deps.latest().channelId);
  const showsActivityVerb = createMemo(
    () => deps.latest().kind === "other" || isStandaloneActivity(),
  );

  const replierIds = createMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const item of deps.items()) {
      if (seen.has(item.userId)) continue;
      seen.add(item.userId);
      ids.push(item.userId);
    }
    return ids;
  });

  const interactorNames = (ids: string[]) =>
    formatInteractorNames(ids, store.users.currentUser()?.id, store.users.userById);

  const reactedMessage = createMemo(() =>
    deps.latest().kind === "reaction"
      ? store.messages.reactionMessages[`${deps.latest().channelId}:${deps.latest().ts}`]?.[0]
      : undefined,
  );
  const matchingReaction = createMemo(() =>
    reactedMessage()?.reactions?.find((r) => r.name === deps.latest().reactionName),
  );

  return {
    avatarUrl,
    channelLabel,
    displayName,
    interactorNames,
    isPinging,
    isReacted,
    isStandaloneActivity,
    isUnread,
    matchingReaction,
    reactedMessage,
    replierIds,
    showsActivityVerb,
    user,
  };
}
