import { service } from "@slock/core/solid";
import { conversationTarget } from "@slock/plugins/conversations/client/api/nav";
import type { HomeSectionProps } from "../api";
import { SidebarUnreadDmSection } from "./rows/SidebarUnreadDmSection";
import { useDmSections } from "./useDmSections";

const sidebarStore = service("sidebar");

export default function UnreadDmSection(props: HomeSectionProps) {
  const dmSections = useDmSections(props.unreadsOnly);
  sidebarStore.provideCycle(0, () =>
    dmSections.unreadDmsOpen()
      ? dmSections.unreadDms().map((dm) => conversationTarget(dm.id, "dm"))
      : [],
  );
  return (
    <SidebarUnreadDmSection
      setUnreadDmsOpen={dmSections.setUnreadDmsOpen}
      unreadDms={dmSections.unreadDms}
      unreadDmsOpen={dmSections.unreadDmsOpen}
    />
  );
}
