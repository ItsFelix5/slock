import { service } from "@slock/core/solid";
import { SLACK_USER_ID } from "@slock/slack";
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
  const isDmUnread = (dm: { id: string }) =>
    unread.isChannelUnread(dm.id) && !prefs.isChannelMuted(dm.id);
  const visibleDms = createMemo(() =>
    dms.directMessages().filter((dm) => {
      if (channels.isChannelStarred(dm.id) || placedIds().has(dm.id)) return false;
      const isOpenDm = isOpen(dm.id, "dm");
      return isOpenDm || !unreadsOnly() || isDmUnread(dm);
    }),
  );
  const isAppDm = (dm: { userId?: string }) =>
    !!dm.userId && (dm.userId === SLACK_USER_ID || !!users.userById(dm.userId)?.isBot);

  const appDms = createMemo(() => visibleDms().filter((dm) => !isDmUnread(dm) && isAppDm(dm)));
  const peopleDms = createMemo(() => visibleDms().filter((dm) => !(isDmUnread(dm) || isAppDm(dm))));

  const dmsFor = (kind: DmKind) => (kind === "people" ? peopleDms() : appDms());

  return {
    dmsFor,
    hasDms: (kind: DmKind) => dmsFor(kind).length > 0 || (kind === "people" && !unreadsOnly()),
    setUnreadDmsOpen,
    unreadDms: createMemo(() => visibleDms().filter(isDmUnread)),
    unreadDmsOpen,
  };
}
