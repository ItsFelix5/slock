import type { HomeSectionProps } from "../api";
import { SidebarUnreadDmSection } from "./rows/SidebarDmSections";
import { useDmSections } from "./useDmSections";

export default function UnreadDmSection(props: HomeSectionProps) {
  const dmSections = useDmSections(props.unreadsOnly);
  return (
    <SidebarUnreadDmSection
      setUnreadDmsOpen={dmSections.setUnreadDmsOpen}
      unreadDms={dmSections.unreadDms}
      unreadDmsOpen={dmSections.unreadDmsOpen}
    />
  );
}
