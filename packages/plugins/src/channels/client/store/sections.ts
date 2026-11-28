import { createQueue } from "@slock/core";
import { service } from "@slock/core/solid";
import { defineMutation, defineQuery } from "@slock/plugins/query/client/api";
import type { Overlay, Transaction } from "@slock/resource";
import type { ChannelId, ChannelSection, UserPrefs } from "@slock/types";
import { createMemo } from "solid-js";
import {
  moveChannelBetweenSections,
  reorderSections,
  setSectionCollapsedPreference,
  setSectionSidebarPreference,
} from "../api/sectionMutations";
import { setChannelSectionsPreference } from "../requests/channels";
import {
  createSection,
  deleteSection,
  fetchFreshSections,
  fetchSections,
  renameSection,
  reorderSection,
} from "../requests/sections";

const feedback = service("feedback");

type CreatedSection = Awaited<ReturnType<typeof createSection>>;

interface SectionEdit {
  failure: string;
  key: string;
  optimistic?: (transaction: Transaction) => void;
  request: () => Promise<void>;
}

interface PreferenceWrite {
  change: (prefs: UserPrefs) => UserPrefs;
  failure?: string;
  key: string;
  prefs: UserPrefs;
  sectionId: string;
}

export function createChannelSections(deps: {
  userPrefs: () => UserPrefs | undefined;
  overlayUserPrefs: (change: (current: UserPrefs) => UserPrefs) => Overlay;
}) {
  let sectionsLoaded = false;
  const sectionsQuery = defineQuery<null, ChannelSection[]>({
    load: (_, { signal }) => {
      const load = sectionsLoaded ? fetchFreshSections : fetchSections;
      sectionsLoaded = true;
      return load(signal);
    },
    name: "channelSections",
  });
  const rawSections = sectionsQuery.state(() => null);
  const refreshSections = () => sectionsQuery.refresh(null).catch(() => undefined);

  const sections = createMemo(() => {
    const { data } = rawSections();
    if (!data) return data;
    const current = deps.userPrefs();
    const sectionSort = current?.sectionSort ?? {};
    const sectionSidebar = current?.sectionSidebar ?? {};
    return data.map((s) => {
      const sort = sectionSort[s.id];
      const sidebar = sectionSidebar[s.id] ?? s.sidebar;
      if (!sort && sidebar === s.sidebar) return s;
      return { ...s, sidebar, ...(sort ? { sort } : {}) };
    });
  });

  const holdChannelSection = (
    transaction: Transaction,
    channelId: ChannelId,
    sectionId: string | null,
  ) =>
    transaction.apply(sectionsQuery, null, (list) =>
      moveChannelBetweenSections(list, channelId, sectionId),
    );

  const structure = defineMutation<() => Promise<void>>({ mode: "single", run: (job) => job() });
  const isSectionStructurePending = () => structure.pending();

  async function changeStructure<T>(job: () => Promise<T>): Promise<T | undefined> {
    let result: T | undefined;
    await structure.run(async () => {
      result = await job();
    });
    return result;
  }

  const edit = defineMutation<SectionEdit>({
    onError: (error, { failure, key }) => {
      console.error(failure, error);
      feedback.flash(key, failure, "error");
    },
    optimistic: ({ optimistic }, transaction) => optimistic?.(transaction),
    run: async ({ request }) => {
      await request();
      await refreshSections();
    },
  });

  const editStructure = async (change: SectionEdit) =>
    (await changeStructure(() => edit.run(change))) ?? false;

  async function createChannelSection(
    name: string,
    feedbackKey = name,
  ): Promise<CreatedSection | null> {
    let created: CreatedSection | undefined;
    await editStructure({
      failure: "Failed to create section.",
      key: feedbackKey,
      request: async () => {
        created = await createSection(name);
      },
    });
    return created ?? null;
  }

  const renameChannelSection = (sectionId: string, name: string) =>
    editStructure({
      failure: "Failed to rename section.",
      key: sectionId,
      request: () => renameSection(sectionId, name),
    });

  const deleteChannelSection = (sectionId: string) =>
    editStructure({
      failure: "Failed to delete section.",
      key: sectionId,
      request: () => deleteSection(sectionId),
    });

  function reorderChannelSection(sectionId: string, nextSectionId: string | null) {
    if (!reorderSections(rawSections().data ?? [], sectionId, nextSectionId))
      return Promise.resolve(false);
    return editStructure({
      failure: "Failed to reorder section.",
      key: sectionId,
      optimistic: (transaction) =>
        transaction.apply(
          sectionsQuery,
          null,
          (list) => reorderSections(list, sectionId, nextSectionId) ?? list,
        ),
      request: () => reorderSection(sectionId, nextSectionId),
    });
  }

  const writes = createQueue(1);
  let accepted: UserPrefs;
  let unsent = 0;
  function writePreference({ change, prefs }: PreferenceWrite) {
    if (unsent++ === 0) accepted = prefs;
    return writes.run(async () => {
      try {
        const next = change(accepted);
        await setChannelSectionsPreference(next.channelSections);
        accepted = next;
      } finally {
        unsent--;
      }
    });
  }

  const preference = defineMutation<PreferenceWrite>({
    key: ({ key }) => key,
    onError: (error, { failure, sectionId }) => {
      console.error("Failed to save section preferences", error);
      if (failure) feedback.flash(sectionId, failure, "error");
    },
    optimistic: ({ change }, transaction) => transaction.hold(deps.overlayUserPrefs(change)),
    run: writePreference,
  });
  const sidebarKey = (sectionId: string) => `sidebar:${sectionId}`;
  const isSectionSidebarPending = (sectionId: string) => preference.pending(sidebarKey(sectionId));
  const sectionById = (sectionId: string) =>
    (sections() ?? []).find((candidate) => candidate.id === sectionId);

  function setChannelSectionSidebar(sectionId: string, sidebar: ChannelSection["sidebar"]) {
    const section = sectionById(sectionId);
    if (
      !section ||
      section.sidebar === sidebar ||
      isSectionStructurePending() ||
      isSectionSidebarPending(sectionId)
    )
      return Promise.resolve(false);

    const prefs = deps.userPrefs();
    if (!prefs) {
      feedback.flash(sectionId, "Preferences are unavailable. Try loading them again.", "error");
      return Promise.resolve(false);
    }
    feedback.clear(sectionId);
    return preference.run({
      change: (current) => setSectionSidebarPreference(current, sectionId, sidebar),
      failure: "Failed to update section filter.",
      key: sidebarKey(sectionId),
      prefs,
      sectionId,
    });
  }

  function toggleSectionFilter(sectionId: string) {
    const section = sectionById(sectionId);
    if (!section) return;
    void setChannelSectionSidebar(sectionId, section.sidebar === "all" ? "hid" : "all");
  }

  const collapsedIds = createMemo(() => {
    const sectionCollapsed = deps.userPrefs()?.sectionCollapsed ?? {};
    return new Set(Object.keys(sectionCollapsed).filter((id) => sectionCollapsed[id]));
  });

  function toggleCategoryCollapsed(sectionId: string) {
    const prefs = deps.userPrefs();
    if (!prefs) return Promise.resolve(false);
    const collapsed = !prefs.sectionCollapsed[sectionId];
    return preference.run({
      change: (current) => setSectionCollapsedPreference(current, sectionId, collapsed),
      key: `collapsed:${sectionId}`,
      prefs,
      sectionId,
    });
  }

  return {
    changeStructure,
    holdChannelSection,
    shared: {
      collapsedIds,
      createChannelSection,
      deleteChannelSection,
      isSectionSidebarPending,
      isSectionStructurePending,
      renameChannelSection,
      reorderChannelSection,
      retrySections: refreshSections,
      setChannelSectionSidebar,
      sections,
      sectionsError: () => (rawSections().data ? undefined : rawSections().error),
      sectionsLoading: () => rawSections().data === undefined && rawSections().error === undefined,
      toggleCategoryCollapsed,
      toggleSectionFilter,
    },
  };
}
