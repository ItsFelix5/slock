import { service } from "@slock/core/solid";
import type { ActivityItem } from "@slock/types";
import { createMemo } from "solid-js";
import {
  hasRealMessageAuthor,
  resolveAuthorAvatarUrl,
  resolveAuthorDisplayName,
  unresolvedAuthorFallback,
} from "../../../messages/client/api/messageAuthor";
import { formatInteractorNames } from "../../../users/client/api";
import { isPingingActivity } from "../kinds";

const titles = service("titles");
const usersStore = service("users");
const messagesStore = service("messages");
const activityStore = service("activity");

export function createActivityRowDisplay(deps: {
  items: () => ActivityItem[];
  latest: () => ActivityItem;
}) {
  const user = createMemo(() => usersStore.userById(deps.latest().userId));
  const displayName = createMemo(() =>
    resolveAuthorDisplayName(deps.latest(), user()?.name, unresolvedAuthorFallback(deps.latest())),
  );
  const avatarUrl = createMemo(() => resolveAuthorAvatarUrl(deps.latest(), user()?.avatarUrl));
  const channelLabel = createMemo(() => {
    if (!deps.latest().channelId) return "Activity";
    return titles.label(deps.latest().channelId);
  });
  const isUnread = createMemo(() => activityStore.isActivityItemUnread(deps.latest()));
  const isArchived = createMemo(() => activityStore.isActivityItemArchived(deps.latest()));
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
      ? messagesStore.reactionMessageFor(deps.latest().channelId, deps.latest().ts)
      : undefined,
  );
  const reactions = createMemo(() => reactedMessage()?.reactions ?? []);

  const replierIds = createMemo(() => {
    const me = usersStore.currentUser()?.id;
    const candidates = [
      ...deps.items().map((item) => item.userId),
      ...reactions().flatMap((reaction) => reaction.users.filter((id) => id !== me)),
    ];
    return [...new Set(candidates)];
  });

  const interactorNames = (ids: string[], max?: number) =>
    formatInteractorNames(ids, usersStore.currentUser()?.id, usersStore.userById, max);

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
