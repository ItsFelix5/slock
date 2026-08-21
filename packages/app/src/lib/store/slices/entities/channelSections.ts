import { createMemo, createResource, createSignal, type Setter } from "solid-js";
import { createStore } from "solid-js/store";
import type { ChannelSection, UserPrefs } from "../../../api";
import {
  createSection as apiCreateSection,
  deleteSection as apiDeleteSection,
  renameSection as apiRenameSection,
  reorderSection as apiReorderSection,
  setChannelSectionsPreference as apiSetChannelSectionsPreference,
  fetchFreshSections,
  fetchSections,
} from "../../../api";
import { reorderSections, setSectionSidebarPreference } from "../../../channelSectionMutations";
import { actionFeedback } from "../../../feedback";
import type { Nav } from "../types";

export function createChannelSections(deps: {
  nav: () => Nav;
  userPrefs: () => UserPrefs | undefined;
  mutateUserPrefs: Setter<UserPrefs | undefined>;
}) {
  let sectionsLoaded = false;
  const loadSections = () => {
    const load = sectionsLoaded ? fetchFreshSections : fetchSections;
    sectionsLoaded = true;
    return load();
  };
  const visitedHome = createMemo<boolean>((prev) => prev || deps.nav() === "home");
  const [rawSections, { refetch: refetchSections, mutate: mutateSections }] = createResource(
    () => (visitedHome() ? true : undefined),
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

  const sections = createMemo(() => {
    const list = rawSections();
    if (!list) return list;
    const prefs = deps.userPrefs();
    const sectionSort = prefs?.sectionSort ?? {};
    const sectionSidebar = prefs?.sectionSidebar ?? {};
    return list.map((s) => {
      const sort = sectionSort[s.id];
      const sidebar = sectionSidebar[s.id] ?? s.sidebar;
      if (!sort && sidebar === s.sidebar) return s;
      return { ...s, sidebar, ...(sort ? { sort } : {}) };
    });
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
    const previousSidebar = prev.sectionSidebar[sectionId];
    setSectionSidebarPendingById(sectionId, true);
    actionFeedback.clear(sectionId);
    deps.mutateUserPrefs((current) =>
      current ? setSectionSidebarPreference(current, sectionId, sidebar) : current,
    );
    const rollback = () =>
      deps.mutateUserPrefs((current) =>
        current ? setSectionSidebarPreference(current, sectionId, previousSidebar) : current,
      );
    try {
      const ok = await apiSetChannelSectionsPreference(deps.userPrefs()?.channelSections ?? {});
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
    sectionsLoading: () => rawSections.loading && rawSections() === undefined,
    toggleSectionFilter,
  };
}
