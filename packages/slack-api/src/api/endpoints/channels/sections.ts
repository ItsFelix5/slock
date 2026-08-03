// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { ChannelSection } from "../../../types";
import { extractChannelSections } from "../../mappers";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../../server";
import { fetchInitialData } from "../initialData";
import {
  type PairedPreferenceValues,
  writePairedPreference,
} from "../preferences/pairedPreferenceWrite";

function mapSections(data: any): ChannelSection[] {
  if (!data.ok) throw new Error(data.error ?? "users.channelSections.list failed");
  const sections = extractChannelSections(data);
  return (sections ?? []).map((s) => ({
    channelIds: s.channelIds,
    id: s.id,
    name: s.name,
    sidebar: s.sidebar,
    type: s.type,
  }));
}

export async function fetchSections(): Promise<ChannelSection[]> {
  const initial = await fetchInitialData();
  const data = initial.sections ?? (await apiGet("/api/sections"));
  return mapSections(data);
}

export async function fetchFreshSections(): Promise<ChannelSection[]> {
  return mapSections(await apiGet("/api/sections"));
}
export async function createSection(name: string): Promise<{ id: string; name: string } | null> {
  const data = await apiPost("/api/sections", { name });
  if (!data.ok) return null;
  const created = data.channel_section ?? data;
  const id = created?.channel_section_id ?? created?.id;
  if (!id) return null;
  return { id, name: created?.name ?? name };
}
export async function renameSection(sectionId: string, name: string): Promise<boolean> {
  const data = await apiPatch(`/api/sections/${sectionId}`, { name });
  return !!data.ok;
}
export async function setSectionSidebar(
  sectionId: string,
  sidebar: "hid" | "active" | "all",
): Promise<boolean> {
  const data = await apiPatch(`/api/sections/${sectionId}`, { sidebar });
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
  const data = await apiPut(`/api/sections/${sectionId}/order`, { nextSectionId });
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
  const data = await apiPost("/api/dms", { userId });
  if (!data.ok) return null;
  return data.channel?.id ?? null;
}
