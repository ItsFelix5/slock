import type { BootstrapSection, ChannelSection, RawChannelSection } from "@slock/types";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, extractChannelSections } from "@slock/types";
import { fetchInitialData } from "../initialData";
import {
  type PairedPreferenceValues,
  writePairedPreference,
} from "../preferences/pairedPreferenceWrite";

function normalizeSectionType(type: string): string {
  return type === "user_group" ? "usergroup" : type;
}

async function fetchSectionList(): Promise<ChannelSection[]> {
  const data = await apiGet<{ channel_sections?: RawChannelSection[] }>("/api/sections");
  if (!data.ok) throw new Error(data.error ?? "users.channelSections.list failed");
  return (extractChannelSections(data) ?? []).map((s) => ({
    channelIds: s.channelIds,
    id: s.id,
    name: s.name,
    sidebar: s.sidebar,
    type: normalizeSectionType(s.type),
  }));
}

function mapInitialSections(sections: Record<string, BootstrapSection>): ChannelSection[] {
  return Object.entries(sections).map(([id, section]) => ({
    channelIds: section.channel_ids ?? [],
    id,
    name: section.name ?? "Section",
    sidebar:
      section.filtering === "all" || section.filtering === "active" ? section.filtering : "hid",
    type: normalizeSectionType(section.type ?? "standard"),
  }));
}

export async function fetchSections(): Promise<ChannelSection[]> {
  const initial = await fetchInitialData();
  if (initial.error?.sections) throw new Error(initial.error.sections);
  return initial.sections === undefined ? fetchSectionList() : mapInitialSections(initial.sections);
}

export const fetchFreshSections = fetchSectionList;

export async function createSection(name: string): Promise<{ id: string; name: string } | null> {
  const data = await apiPost<{ channel_section: RawChannelSection }>("/api/sections", { name });
  if (!data.ok) return null;
  const created = data.channel_section;
  const id = created.channel_section_id ?? created.id;
  if (!id) return null;
  return { id, name: created.name ?? name };
}
export async function renameSection(sectionId: string, name: string): Promise<boolean> {
  const data = await apiPatch(`/api/sections/${sectionId}`, { name });
  return !!data.ok;
}
export async function deleteSection(sectionId: string): Promise<boolean> {
  const data = await apiDelete(`/api/sections/${sectionId}`);
  return !!data.ok;
}
export async function reorderSection(
  sectionId: string,
  nextSectionId: string | null,
): Promise<boolean> {
  const data = await apiPut(`/api/sections/${sectionId}/order`, {
    nextSectionId,
  });
  return !!data.ok;
}
export async function updateSectionChannels(
  sectionId: string,
  changes: { insertChannelIds?: string[]; removeChannelIds?: string[] },
): Promise<boolean> {
  const data = await apiPut(`/api/sections/${sectionId}/channels`, changes);
  return !!data.ok;
}
export async function setChannelNotifyAll(
  channelId: string,
  notifyAll: boolean,
  previous: { desktop?: string; mobile?: string } = {},
): Promise<void> {
  const value = notifyAll ? "everything" : "mentions_dms";
  const fallbackPrevious = notifyAll ? "mentions_dms" : "everything";
  const previousValues: PairedPreferenceValues = {
    desktop: previous.desktop ?? fallbackPrevious,
    mobile: previous.mobile ?? fallbackPrevious,
  };
  await writePairedPreference(value, previousValues, async (target, targetValue) => {
    const result = await apiPut(`/api/channels/${channelId}/notifications`, {
      target,
      value: targetValue,
    });
    return !!result.ok;
  });
}
export async function openDm(userId: string): Promise<string | null> {
  const data = await apiPost<{ channel: { id: string } }>("/api/dms", { userId });
  if (!data.ok) return null;
  return data.channel.id;
}
