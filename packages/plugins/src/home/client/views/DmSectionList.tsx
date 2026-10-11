import type { HomeSectionProps } from "../api";
import SidebarDmSections from "./rows/SidebarDmSections";
import { useDmSections } from "./useDmSections";

export default function DmSectionList(props: HomeSectionProps) {
  const dmSections = useDmSections(props.unreadsOnly);
  return (
    <SidebarDmSections
      appDms={dmSections.appDms}
      appsOpen={dmSections.appsOpen}
      dmsOpen={dmSections.dmsOpen}
      peopleDms={dmSections.peopleDms}
      setAppsOpen={dmSections.setAppsOpen}
      setDmsOpen={dmSections.setDmsOpen}
      unreadsOnly={props.unreadsOnly}
    />
  );
}
