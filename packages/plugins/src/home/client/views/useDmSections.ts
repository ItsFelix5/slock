import { service } from "@slock/core/solid";
import { SLACK_USER_ID } from "@slock/slack";
import { type Accessor, createMemo, createSignal } from "solid-js";

export function useDmSections(unreadsOnly: Accessor<boolean>) {
  const dms = service("dms");
  const unread = service("unread");
  const panes = service("conversations");
  const prefs = service("prefs");
  const users = service("users");
  const [unreadDmsOpen, setUnreadDmsOpen] = createSignal(true);
  const [dmsOpen, setDmsOpen] = createSignal(true);
  const [appsOpen, setAppsOpen] = createSignal(true);

  const isDmUnread = (dm: { id: string }) =>
    unread.isChannelUnread(dm.id) && !prefs.isChannelMuted(dm.id);
  const visibleDms = createMemo(() =>
    dms.directMessages().filter((dm) => {
      const isOpen = panes.isOpenInAnyPane(dm.id, "dm");
      return isOpen || !unreadsOnly() || isDmUnread(dm);
    }),
  );
  const isAppDm = (dm: { userId?: string }) =>
    !!dm.userId && (dm.userId === SLACK_USER_ID || !!users.userById(dm.userId)?.isBot);

  return {
    appDms: createMemo(() => visibleDms().filter((dm) => !isDmUnread(dm) && isAppDm(dm))),
    appsOpen,
    dmsOpen,
    peopleDms: createMemo(() => visibleDms().filter((dm) => !(isDmUnread(dm) || isAppDm(dm)))),
    setAppsOpen,
    setDmsOpen,
    setUnreadDmsOpen,
    unreadDms: createMemo(() => visibleDms().filter(isDmUnread)),
    unreadDmsOpen,
  };
}
