import type { ActivityItem } from "@slock/types";
import { createMemo } from "solid-js";
import { isPingingActivity } from "../../../lib/activityKinds";
import { conversationDisplayName, formatInteractorNames } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import {
  hasRealMessageAuthor,
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  unresolvedAuthorFallback,
} from "../../messages/parts/messageAuthor";

export function createActivityRowDisplay(deps: {
  items: () => ActivityItem[];
  latest: () => ActivityItem;
}) {
  const user = createMemo(() => store.users.userById(deps.latest().userId));
  const displayName = createMemo(() =>
    resolveAuthorDisplayName(deps.latest(), user()?.name, unresolvedAuthorFallback(deps.latest())),
  );
  const avatarUrl = createMemo(() => resolveAuthorAvatarUrl(deps.latest(), user()?.avatarUrl));
  const channelLabel = createMemo(() => {
    if (!deps.latest().channelId) return "Activity";
    return conversationDisplayName(
      deps.latest().channelId,
      store.channels.channelById,
      store.dms.dmById,
      store.users.userById,
    );
  });
  const isUnread = createMemo(() => store.activity.isActivityItemUnread(deps.latest()));
  const isArchived = createMemo(() => store.activity.isActivityItemArchived(deps.latest()));
  const isPinging = createMemo(() => isPingingActivity(deps.latest()));
  const isStandaloneActivity = createMemo(() => !deps.latest().channelId);
  const hasKnownActor = createMemo(() => hasRealMessageAuthor(deps.latest()));
  const hasAnyActor = createMemo(
    () => hasKnownActor() || !!deps.latest().botId || !!deps.latest().botName,
  );
  const showsActivityVerb = createMemo(
    () => deps.latest().kind === "other" || isStandaloneActivity(),
  );

  const reactedMessage = createMemo(() =>
    deps.latest().kind === "reaction"
      ? store.messages.reactionMessageFor(deps.latest().channelId, deps.latest().ts)
      : undefined,
  );
  const reactions = createMemo(() => reactedMessage()?.reactions ?? []);

  const replierIds = createMemo(() => {
    const me = store.users.currentUser()?.id;
    const candidates = [
      ...deps.items().map((item) => item.userId),
      ...reactions().flatMap((reaction) => reaction.users.filter((id) => id !== me)),
    ];
    return [...new Set(candidates)];
  });

  const interactorNames = (ids: string[], max?: number) =>
    formatInteractorNames(ids, store.users.currentUser()?.id, store.users.userById, max);

  return {
    avatarUrl,
    channelLabel,
    displayName,
    hasAnyActor,
    hasKnownActor,
    interactorNames,
    isArchived,
    isPinging,
    isStandaloneActivity,
    isUnread,
    reactedMessage,
    reactions,
    replierIds,
    showsActivityVerb,
    user,
  };
}

export type ActivityRowDisplay = ReturnType<typeof createActivityRowDisplay>;
