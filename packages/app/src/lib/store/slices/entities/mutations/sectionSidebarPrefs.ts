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

export function setUsergroupSectionSidebarPreference(
  prefs: UserPrefs,
  sectionId: string,
  sidebar: ChannelSection["sidebar"] | undefined,
): UserPrefs {
  const usergroupSectionSidebar = { ...prefs.usergroupSectionSidebar };
  if (sidebar === undefined) delete usergroupSectionSidebar[sectionId];
  else usergroupSectionSidebar[sectionId] = sidebar;
  return { ...prefs, usergroupSectionSidebar };
}

export function setUsergroupSectionOrderPreference(
  prefs: UserPrefs,
  sectionIds: string[],
): UserPrefs {
  return { ...prefs, usergroupSectionOrder: sectionIds };
}
