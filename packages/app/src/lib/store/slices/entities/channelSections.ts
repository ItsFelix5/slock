import type { ChannelSection, UserPrefs } from "@slock/slack-api";
import {
  createSection as apiCreateSection,
  deleteSection as apiDeleteSection,
  renameSection as apiRenameSection,
  reorderSection as apiReorderSection,
  setChannelSectionsPreference as apiSetChannelSectionsPreference,
  setUsergroupSectionOrderPreference as apiSetUsergroupSectionOrderPreference,
  fetchFreshSections,
  fetchSections,
  setUsergroupSectionSidebarPreferences,
} from "@slock/slack-api";
import { createMemo, createResource, createSignal, type Setter } from "solid-js";
import { createStore } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { Nav } from "../types";
import { applySectionOrder, reorderSections } from "./mutations/sectionOrder";
import {
  setSectionSidebarPreference,
  setUsergroupSectionOrderPreference,
  setUsergroupSectionSidebarPreference,
} from "./mutations/sectionSidebarPrefs";

export function createChannelSections(deps: {
  nav: () => Nav;
  usergroupSections: () => ChannelSection[];
  userPrefs: () => UserPrefs | undefined;
  mutateUserPrefs: Setter<UserPrefs | undefined>;
}) {
  let sectionsLoaded = false;
  const loadSections = () => {
    const load = sectionsLoaded ? fetchFreshSections : fetchSections;
    sectionsLoaded = true;
    return load();
  };
  const [rawSections, { refetch: refetchSections, mutate: mutateSections }] = createResource(
    () => (deps.nav() === "home" ? true : undefined),
    loadSections,
  );
  const [sectionStructurePending, setSectionStructurePending] = createSignal(false);
  const [sectionSidebarPendingById, setSectionSidebarPendingById] = createStore<
    Record<string, boolean>
  >({});
  async function refreshSections(): Promise<ChannelSection[] | null | undefined> {
    try {
      return await refetchSections();
    } catch {}
  }

  const sections = createMemo<ChannelSection[] | undefined>(() => {
    const list = rawSections();
    const groupSections = deps.usergroupSections();
    const prefs = deps.userPrefs();
    const visibleGroupSections = groupSections.map((section) => ({
      ...section,
      sidebar: prefs?.usergroupSectionSidebar[section.id] ?? section.sidebar,
    }));
    const usergroupOrder =
      visibleGroupSections.length > 0 ? (prefs?.usergroupSectionOrder ?? []) : [];
    if (!list)
      return visibleGroupSections.length > 0
        ? applySectionOrder(visibleGroupSections, usergroupOrder)
        : list;
    const sectionSort = prefs?.sectionSort ?? {};
    const sectionSidebar = prefs?.sectionSidebar ?? {};
    const personalSections = list.map((s) => {
      const sort = sectionSort[s.id];
      const sidebar = sectionSidebar[s.id] ?? s.sidebar;
      if (!sort && sidebar === s.sidebar) return s;
      return { ...s, sidebar, ...(sort ? { sort } : {}) };
    });
    const personalIds = new Set(personalSections.map((section) => section.id));
    return applySectionOrder(
      [
        ...personalSections,
        ...visibleGroupSections.filter((section) => !personalIds.has(section.id)),
      ],
      usergroupOrder,
    );
  });

  async function createChannelSection(
    name: string,
    feedbackKey = name,
  ): Promise<{ id: string; name: string } | null> {
    if (sectionStructurePending()) return null;
    setSectionStructurePending(true);
    try {
      const created = await apiCreateSection(name);
      if (!created) {
        actionFeedback.flash(feedbackKey, "Failed to create section.", "error");
        return null;
      }
      await refreshSections();
      return created;
    } catch (err) {
      console.error("Failed to create section", err);
      actionFeedback.flash(feedbackKey, "Failed to create section.", "error");
      return null;
    } finally {
      setSectionStructurePending(false);
    }
  }

  async function renameChannelSection(sectionId: string, name: string): Promise<boolean> {
    if (sectionStructurePending()) return false;
    setSectionStructurePending(true);
    try {
      if (await apiRenameSection(sectionId, name)) {
        await refreshSections();
        return true;
      }
      actionFeedback.flash(sectionId, "Failed to rename section.", "error");
      return false;
    } catch (err) {
      console.error("Failed to rename section", err);
      actionFeedback.flash(sectionId, "Failed to rename section.", "error");
      return false;
    } finally {
      setSectionStructurePending(false);
    }
  }

  async function deleteChannelSection(sectionId: string): Promise<boolean> {
    if (sectionStructurePending()) return false;
    setSectionStructurePending(true);
    try {
      if (await apiDeleteSection(sectionId)) {
        await refreshSections();
        return true;
      }
      actionFeedback.flash(sectionId, "Failed to delete section.", "error");
      return false;
    } catch (err) {
      console.error("Failed to delete section", err);
      actionFeedback.flash(sectionId, "Failed to delete section.", "error");
      return false;
    } finally {
      setSectionStructurePending(false);
    }
  }

  function isSectionSidebarPending(sectionId: string): boolean {
    return !!sectionSidebarPendingById[sectionId];
  }

  async function setChannelSectionSidebar(
    sectionId: string,
    sidebar: ChannelSection["sidebar"],
  ): Promise<boolean> {
    const section = (sections() ?? []).find((candidate) => candidate.id === sectionId);
    if (
      !section ||
      section.sidebar === sidebar ||
      sectionStructurePending() ||
      isSectionSidebarPending(sectionId)
    )
      return false;

    const prev = deps.userPrefs();
    if (!prev) {
      actionFeedback.flash(
        sectionId,
        "Preferences are unavailable. Try loading them again.",
        "error",
      );
      return false;
    }
    const isUsergroupSection = section.type === "usergroup";
    const previousSidebar = isUsergroupSection
      ? prev.usergroupSectionSidebar[sectionId]
      : prev.sectionSidebar[sectionId];
    setSectionSidebarPendingById(sectionId, true);
    actionFeedback.clear(sectionId);
    deps.mutateUserPrefs((current) =>
      current
        ? isUsergroupSection
          ? setUsergroupSectionSidebarPreference(current, sectionId, sidebar)
          : setSectionSidebarPreference(current, sectionId, sidebar)
        : current,
    );
    const rollback = () =>
      deps.mutateUserPrefs((current) =>
        current
          ? isUsergroupSection
            ? setUsergroupSectionSidebarPreference(current, sectionId, previousSidebar)
            : setSectionSidebarPreference(current, sectionId, previousSidebar)
          : current,
      );
    try {
      const ok = isUsergroupSection
        ? await setUsergroupSectionSidebarPreferences({
            ...prev.usergroupSectionSidebar,
            [sectionId]: sidebar,
          })
        : await apiSetChannelSectionsPreference(deps.userPrefs()?.channelSections ?? {});
      if (ok) return true;
      actionFeedback.flash(sectionId, "Failed to update section filter.", "error");
      rollback();
      return false;
    } catch (err) {
      console.error("Failed to update section filter", err);
      actionFeedback.flash(sectionId, "Failed to update section filter.", "error");
      rollback();
      return false;
    } finally {
      setSectionSidebarPendingById(sectionId, false);
    }
  }

  function toggleSectionFilter(sectionId: string) {
    const section = (sections() ?? []).find((candidate) => candidate.id === sectionId);
    if (!section) return;
    void setChannelSectionSidebar(sectionId, section.sidebar === "all" ? "hid" : "all");
  }

  async function reorderChannelSection(
    sectionId: string,
    nextSectionId: string | null,
  ): Promise<boolean> {
    if (sectionStructurePending()) return false;
    const current = sections() ?? [];
    const optimistic = reorderSections(current, sectionId, nextSectionId);
    if (!optimistic) return false;

    if (current.some((section) => section.type === "usergroup")) {
      const previousPrefs = deps.userPrefs();
      if (!previousPrefs) {
        actionFeedback.flash(
          sectionId,
          "Preferences are unavailable. Try loading them again.",
          "error",
        );
        return false;
      }
      const nextOrder = optimistic.map((section) => section.id);
      setSectionStructurePending(true);
      actionFeedback.clear(sectionId);
      deps.mutateUserPrefs((prefs) =>
        prefs ? setUsergroupSectionOrderPreference(prefs, nextOrder) : prefs,
      );
      const rollback = () =>
        deps.mutateUserPrefs((prefs) =>
          prefs
            ? setUsergroupSectionOrderPreference(prefs, previousPrefs.usergroupSectionOrder)
            : prefs,
        );
      try {
        if (await apiSetUsergroupSectionOrderPreference(nextOrder)) return true;
        actionFeedback.flash(sectionId, "Failed to reorder section.", "error");
        rollback();
        return false;
      } catch (err) {
        console.error("Failed to reorder section", err);
        actionFeedback.flash(sectionId, "Failed to reorder section.", "error");
        rollback();
        return false;
      } finally {
        setSectionStructurePending(false);
      }
    }
    setSectionStructurePending(true);
    mutateSections(optimistic);
    try {
      if (await apiReorderSection(sectionId, nextSectionId)) {
        await refreshSections();
        return true;
      }
      actionFeedback.flash(sectionId, "Failed to reorder section.", "error");
      mutateSections(current);
      return false;
    } catch (err) {
      console.error("Failed to reorder section", err);
      actionFeedback.flash(sectionId, "Failed to reorder section.", "error");
      mutateSections(current);
      return false;
    } finally {
      setSectionStructurePending(false);
    }
  }

  return {
    createChannelSection,
    deleteChannelSection,
    isSectionSidebarPending,
    isSectionStructurePending: sectionStructurePending,
    renameChannelSection,
    reorderChannelSection,
    retrySections: refreshSections,
    sectionStructurePending,
    setChannelSectionSidebar,
    setSectionStructurePending,
    sections,
    sectionsError: () => rawSections.error,
    sectionsLoading: () => rawSections.loading,
    toggleSectionFilter,
  };
}
