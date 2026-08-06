import type { ChannelSection, UserPrefs } from "@slock/slack-api";

export function setSectionSidebarPreference(
  prefs: UserPrefs,
  sectionId: string,
  sidebar: ChannelSection["sidebar"] | undefined,
): UserPrefs {
  const sectionSidebar = { ...prefs.sectionSidebar };
  const channelSections = { ...prefs.channelSections };
  const entry = { ...channelSections[sectionId] };
  if (sidebar === undefined) {
    delete sectionSidebar[sectionId];
    entry.sidebar = undefined;
  } else {
    sectionSidebar[sectionId] = sidebar;
    entry.sidebar = sidebar;
  }
  channelSections[sectionId] = entry;
  return { ...prefs, sectionSidebar, channelSections };
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
