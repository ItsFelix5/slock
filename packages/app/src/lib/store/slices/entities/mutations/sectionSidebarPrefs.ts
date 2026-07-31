import type { ChannelSection, UserPrefs } from "@slock/slack-api";

export function setSectionSidebarPreference(
  prefs: UserPrefs,
  sectionId: string,
  sidebar: ChannelSection["sidebar"] | undefined,
): UserPrefs {
  const sectionSidebar = { ...prefs.sectionSidebar };
  if (sidebar === undefined) delete sectionSidebar[sectionId];
  else sectionSidebar[sectionId] = sidebar;
  return { ...prefs, sectionSidebar };
}
