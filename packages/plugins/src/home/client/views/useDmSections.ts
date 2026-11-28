import { service } from "@slock/core/solid";
import { SLACK_USER_ID } from "@slock/slack";
import type { ChannelId, UserId } from "@slock/types";
import { type Accessor, createMemo, createSignal } from "solid-js";
import type { DmKind } from "./categories";
import { useOpenViews } from "./useOpenViews";

export function useDmSections(unreadsOnly: Accessor<boolean>) {
  const dms = service("dms");
  const channels = service("channels");
  const unread = service("unread");
  const isOpen = useOpenViews();
  const prefs = service("prefs");
  const users = service("users");
  const [unreadDmsOpen, setUnreadDmsOpen] = createSignal(true);

  const placedIds = createMemo(
    () =>
      new Set(
        (channels.sections() ?? [])
          .filter((section) => section.type === "standard")
          .flatMap((section) => section.channelIds),
      ),
  );
  const isDmUnread = (dm: { id: ChannelId }) =>
    unread.isChannelUnread(dm.id) && !prefs.isChannelMuted(dm.id);
  const visibleDms = createMemo(() =>
    dms.directMessages().filter((dm) => {
      if (channels.isChannelStarred(dm.id) || placedIds().has(dm.id)) return false;
      const isOpenDm = isOpen(dm.id, "dm");
      return isOpenDm || !unreadsOnly() || isDmUnread(dm);
    }),
  );
  const dmKind = (dm: { userId?: UserId }): DmKind =>
    dm.userId && (dm.userId === SLACK_USER_ID || users.userById(dm.userId)?.isBot)
      ? "apps"
      : "people";

  const readDms = createMemo(() => visibleDms().filter((dm) => !isDmUnread(dm)));
  const appDms = createMemo(() => readDms().filter((dm) => dmKind(dm) === "apps"));
  const peopleDms = createMemo(() => readDms().filter((dm) => dmKind(dm) === "people"));

  const dmsFor = (kind: DmKind) => (kind === "people" ? peopleDms() : appDms());

  return {
    dmKind,
    dmsFor,
    hasDms: (kind: DmKind) => dmsFor(kind).length > 0 || (kind === "people" && !unreadsOnly()),
    setUnreadDmsOpen,
    unreadDms: createMemo(() => visibleDms().filter(isDmUnread)),
    unreadDmsOpen,
  };
}
