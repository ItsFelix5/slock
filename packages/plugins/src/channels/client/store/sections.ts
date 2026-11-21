import { createOptimisticFlags, service } from "@slock/core/solid";
import type { ChannelSection, UserPrefs } from "@slock/types";
import { action, createMemo, createOptimistic } from "solid-js";
import { defineQuery } from "../../../query/client/api";
import {
  createSection as apiCreateSection,
  deleteSection as apiDeleteSection,
  renameSection as apiRenameSection,
  reorderSection as apiReorderSection,
  setChannelSectionsPreference as apiSetChannelSectionsPreference,
  fetchFreshSections,
  fetchSections,
} from "../../../slack/client/api";
import {
  reorderSections,
  setSectionCollapsedPreference,
  setSectionSidebarPreference,
} from "../api/sectionMutations";

const feedback = service("feedback");

export function createChannelSections(deps: {
  userPrefs: () => UserPrefs | undefined;
  mutateUserPrefs: (updater: (current: UserPrefs | undefined) => UserPrefs | undefined) => void;
}) {
  let sectionsLoaded = false;
  const loadSections = () => {
    const load = sectionsLoaded ? fetchFreshSections : fetchSections;
    sectionsLoaded = true;
    return load();
  };
  const sectionsQuery = defineQuery<null, ChannelSection[]>({
    load: loadSections,
    name: "channelSections",
  });
  const rawSections = sectionsQuery.state(() => null);
  const [list, holdList] = createOptimistic(() => rawSections().data);
  const [prefs, holdPrefs] = createOptimistic(() => deps.userPrefs());
  const [sectionStructurePending, setSectionStructurePending] = createOptimistic(false);
  const holdSectionStructure = () => setSectionStructurePending(true);
  const sidebarPending = createOptimisticFlags<string>();
  const isSectionSidebarPending = sidebarPending.has;
  const refreshSections = () => sectionsQuery.refresh(null).catch(() => undefined);

  const sections = createMemo(() => {
    if (rawSections().error) return;
    const data = list();
    if (!data) return data;
    const current = prefs();
    const sectionSort = current?.sectionSort ?? {};
    const sectionSidebar = current?.sectionSidebar ?? {};
    return data.map((s) => {
      const sort = sectionSort[s.id];
      const sidebar = sectionSidebar[s.id] ?? s.sidebar;
      if (!sort && sidebar === s.sidebar) return s;
      return { ...s, sidebar, ...(sort ? { sort } : {}) };
    });
  });

  const structuralChange = action(function* <T>(
    key: string,
    failure: string,
    request: () => Promise<T | false | null | undefined>,
    optimistic?: () => void,
  ) {
    if (sectionStructurePending()) return null;
    holdSectionStructure();
    optimistic?.();
    let result: T | false | null | undefined;
    try {
      result = yield request();
    } catch (err) {
      console.error(failure, err);
    }
    if (!result) {
      feedback.flash(key, failure, "error");
      return null;
    }
    yield refreshSections();
    return result;
  });

  const createChannelSection = (name: string, feedbackKey = name) =>
    structuralChange(feedbackKey, "Failed to create section.", () => apiCreateSection(name));

  const renameChannelSection = async (sectionId: string, name: string) =>
    (await structuralChange(sectionId, "Failed to rename section.", () =>
      apiRenameSection(sectionId, name),
    )) !== null;

  const deleteChannelSection = async (sectionId: string) =>
    (await structuralChange(sectionId, "Failed to delete section.", () =>
      apiDeleteSection(sectionId),
    )) !== null;

  const reorderChannelSection = async (sectionId: string, nextSectionId: string | null) => {
    const reordered = reorderSections(list() ?? [], sectionId, nextSectionId);
    if (!reordered) return false;
    const done = await structuralChange(
      sectionId,
      "Failed to reorder section.",
      () => apiReorderSection(sectionId, nextSectionId),
      () => holdList(reordered),
    );
    return done !== null;
  };

  const savePrefs = (next: UserPrefs): Promise<boolean> =>
    apiSetChannelSectionsPreference(next.channelSections).catch((err) => {
      console.error("Failed to save section preferences", err);
      return false;
    });

  const setChannelSectionSidebar = action(function* (
    sectionId: string,
    sidebar: ChannelSection["sidebar"],
  ) {
    const section = (sections() ?? []).find((candidate) => candidate.id === sectionId);
    if (
      !section ||
      section.sidebar === sidebar ||
      sectionStructurePending() ||
      isSectionSidebarPending(sectionId)
    )
      return false;

    const prev = prefs();
    if (!prev) {
      feedback.flash(sectionId, "Preferences are unavailable. Try loading them again.", "error");
      return false;
    }
    sidebarPending.hold(sectionId, true);
    feedback.clear(sectionId);
    const next = setSectionSidebarPreference(prev, sectionId, sidebar);
    holdPrefs(next);
    const saved: boolean = yield savePrefs(next);
    if (!saved) {
      feedback.flash(sectionId, "Failed to update section filter.", "error");
      return false;
    }
    deps.mutateUserPrefs((current) =>
      current ? setSectionSidebarPreference(current, sectionId, sidebar) : current,
    );
    return true;
  });

  function toggleSectionFilter(sectionId: string) {
    const section = (sections() ?? []).find((candidate) => candidate.id === sectionId);
    if (!section) return;
    void setChannelSectionSidebar(sectionId, section.sidebar === "all" ? "hid" : "all");
  }

  const collapsedIds = createMemo(() => {
    const sectionCollapsed = prefs()?.sectionCollapsed ?? {};
    return new Set(Object.keys(sectionCollapsed).filter((id) => sectionCollapsed[id]));
  });

  const toggleCategoryCollapsed = action(function* (sectionId: string) {
    const prev = prefs();
    if (!prev) return false;
    const collapsed = !prev.sectionCollapsed[sectionId];
    const next = setSectionCollapsedPreference(prev, sectionId, collapsed);
    holdPrefs(next);
    const saved: boolean = yield savePrefs(next);
    if (!saved) return false;
    deps.mutateUserPrefs((current) =>
      current ? setSectionCollapsedPreference(current, sectionId, collapsed) : current,
    );
    return true;
  });

  return {
    collapsedIds,
    createChannelSection,
    deleteChannelSection,
    holdSectionStructure,
    isSectionSidebarPending,
    isSectionStructurePending: sectionStructurePending,
    renameChannelSection,
    reorderChannelSection,
    retrySections: refreshSections,
    sectionStructurePending,
    setChannelSectionSidebar,
    sections,
    sectionsError: () => rawSections().error,
    sectionsLoading: () => rawSections().data === undefined && rawSections().error === undefined,
    toggleCategoryCollapsed,
    toggleSectionFilter,
  };
}
